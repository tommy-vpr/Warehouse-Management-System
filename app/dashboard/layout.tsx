"use client";
import { ReactNode, useState } from "react";
import {
  Bell,
  Package,
  Scan,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Import,
  Menu,
  X,
  RefreshCw,
  FileText,
  MapPin,
  CalendarDays,
  ArrowLeftRight,
  ShoppingBag,
  LaptopMinimal,
  ChartColumn,
  User,
  Scroll,
  Undo2,
  Home,
  ScanBarcode,
  ClipboardList,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/notification/NotificationBell";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const { data: notificationData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const unreadCount = notificationData?.unreadCount || 0;

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LaptopMinimal },
    { id: "inventory", label: "Inventory", icon: ChartColumn },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "my-work", label: "My Work", icon: User },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      showCount: true,
    },
    { id: "inventory/receive/po", label: "Purchase Orders", icon: FileText },
    { id: "returns", label: "Returns", icon: Undo2 },
    { id: "invoice", label: "Invoice", icon: Scroll },
    { id: "locations/print-labels", label: "Locations", icon: MapPin },
    { id: "inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
    { id: "backorders", label: "Backorders", icon: ShoppingBag },
    { id: "inventory-planner", label: "Inventory Planner", icon: CalendarDays },
    { id: "picking", label: "Picking", icon: ScanBarcode },
    { id: "packing", label: "Packing", icon: Package },
    { id: "shipping", label: "Tracking", icon: Truck },
    { id: "import", label: "Import", icon: Import },
    { id: "inventory/count", label: "Cycle Count", icon: RefreshCw },
    { id: "tech-stack", label: "Tech Stack", icon: Waypoints },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const activeItem = menuItems
    .filter((item) => pathname.startsWith(`/dashboard/${item.id}`))
    .sort((a, b) => b.id.length - a.id.length)[0]?.id;

  const checkActive = (id: string) => id === activeItem;

  const quickActions = [
    {
      href: "/dashboard/inventory/receive/scan",
      icon: ScanBarcode,
      label: "Scan",
    },
    { href: "/dashboard/my-work", icon: ClipboardList, label: "Tasks" },
    { href: "/dashboard/orders", icon: FileText, label: "Orders" },
    { href: "/dashboard", icon: Home, label: "Home" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - FIXED */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              className="sm:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>

            <div className="relative hidden md:block md:w-10 md:h-10">
              <Link href={"/dashboard"}>
                <Image
                  src="/images/headquarter-logo.webp"
                  alt="HQ warehouse management"
                  fill
                  className="object-contain dark:invert"
                  sizes="(max-width: 640px) 32px, 48px"
                />
              </Link>
            </div>

            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/dashboard/inventory/receive/scan"
              className="hidden sm:block"
            >
              <Button className="cursor-pointer bg-blue-600 hover:bg-blue-700 dark:text-gray-200">
                <ScanBarcode className="w-4 h-4" />
                Receive
              </Button>
            </Link>
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Sidebar - FIXED with scroll */}
      <aside
        className={clsx(
          "fixed left-0 z-40 w-64 bg-card border-r border-border overflow-y-auto",
          "top-[73px]", // Adjust based on your header height
          "bottom-0",
          "transition-transform duration-200 ease-in-out",
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full sm:translate-x-0"
        )}
      >
        {/* Close button for mobile */}
        <div className="flex justify-end sm:hidden p-2 sticky top-0 bg-card z-10 border-b border-border">
          <button onClick={() => setMobileMenuOpen(false)}>
            <X className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 pb-8">
          {menuItems.map((item) => {
            const href =
              item.id === "dashboard" ? "/dashboard" : `/dashboard/${item.id}`;
            const active = checkActive(item.id);
            return (
              <Link
                key={item.id}
                href={href}
                className={clsx(
                  "text-xs w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors",
                  active
                    ? "bg-gray-200 text-zinc-900 dark:bg-black dark:text-gray-200"
                    : "text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="w-4 h-4" />
                  <span>
                    {item.label}
                    {item.label === "Notifications" &&
                      item.showCount &&
                      unreadCount > 0 && (
                        <> ({unreadCount > 99 ? "99+" : unreadCount})</>
                      )}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 sm:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content - with proper margins for fixed header and sidebar */}
      <main className="pt-[90px] sm:pl-80 p-0 sm:p-6 sm:pt-16 pb-20 sm:pb-6 min-h-screen">
        <Suspense fallback={<div className="p-4">Loading view...</div>}>
          {children}
        </Suspense>
      </main>

      {/* Mobile footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg sm:hidden z-50">
        <div className="grid grid-cols-4 gap-1 p-2">
          {quickActions.map((action) => {
            const isActive = pathname === action.href;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={clsx(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                  isActive ? "bg-gray-200 dark:bg-black/30" : "hover:bg-accent"
                )}
              >
                <action.icon
                  className={clsx(
                    "w-5 h-5",
                    isActive
                      ? "text-zinc-900 dark:text-white"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={clsx(
                    "text-xs",
                    isActive
                      ? "text-zinc-900 dark:text-white font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
