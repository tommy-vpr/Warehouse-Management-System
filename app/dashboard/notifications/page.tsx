"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { useMemo } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface FetchNotificationsParams {
  limit: number;
  pageParam: number;
}

const fetchNotifications = async ({
  limit,
  pageParam,
}: FetchNotificationsParams): Promise<{
  notifications: Notification[];
  unreadCount: number;
  total: number;
}> => {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(pageParam),
  });

  const res = await fetch(`/api/notifications?${params}`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
};

export default function NotificationsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["notifications-infinite"],
      queryFn: ({ pageParam = 0 }) =>
        fetchNotifications({ limit: 10, pageParam }),
      getNextPageParam: (lastPage, allPages) => {
        const totalLoaded = allPages.reduce(
          (sum, page) => sum + page.notifications.length,
          0
        );
        if (totalLoaded >= lastPage.total) {
          return undefined;
        }
        return allPages.length;
      },
      initialPageParam: 0,
      staleTime: 30 * 1000,
    });

  const notifications = useMemo(() => {
    return data?.pages.flatMap((page) => page.notifications) ?? [];
  }, [data]);

  const unreadCount = data?.pages[0]?.unreadCount || 0;
  const totalCount = data?.pages[0]?.total || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] }); // For bell icon
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] }); // For bell icon
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6" />
              <CardTitle>Notifications</CardTitle>
              {unreadCount > 0 && <span>{unreadCount}</span>}
              {/* {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} unread</Badge>
              )} */}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="cursor-pointer"
              >
                {markAllReadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>Mark all read</>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Bell className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No notifications yet
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y dark:divide-border">
                {notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer transition-colors ${
                      !notification.read
                        ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-blue-500">
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-200 mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                          }}
                          className="shrink-0 cursor-pointer"
                        >
                          {/* <Check className="w-4 h-4" /> */}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="p-4 border-t dark:border-border text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      `Load More (${
                        totalCount - notifications.length
                      } remaining)`
                    )}
                  </Button>
                </div>
              )}

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-muted border-t dark:border-border text-sm text-gray-600 dark:text-gray-400 text-center">
                  Showing {notifications.length} of {totalCount} notifications
                  {!hasNextPage && " (all loaded)"}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
