"use client";

import { useSession, signOut } from "next-auth/react";
import {
  User,
  Settings,
  LogOut,
  Shield,
  UserCog,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        <User className="w-4 h-4" />
      </Button>
    );
  }

  if (!session) {
    return (
      <Button variant="outline" size="sm">
        <User className="w-4 h-4" />
      </Button>
    );
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400";
      case "MANAGER":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400";
      case "STAFF":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400";
      case "READONLY":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSignOut = () => {
    signOut({
      callbackUrl: "/",
      redirect: true,
    });
  };

  console.log(session?.user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center space-x-2 cursor-pointer ring-3 ring-gray-300 dark:ring-zinc-600 hover:ring-gray-400 dark:hover:ring-zinc-500 rounded-full transition-all">
          {/* Avatar with image or initials */}
          <Avatar className="h-8 w-8 hover:opacity-85 transition">
            <AvatarImage
              src={session.user?.image || undefined}
              alt={session.user?.name || "User"}
            />
            <AvatarFallback className="bg-zinc-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 text-xs font-medium">
              {getInitials(session.user?.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              {/* Larger avatar in dropdown */}
              {/* <Avatar className="h-10 w-10">
                <AvatarImage
                  src={session.user?.image || undefined}
                  alt={session.user?.name || "User"}
                />
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-medium">
                  {getInitials(session.user?.name)}
                </AvatarFallback>
              </Avatar> */}

              <div className="flex-1">
                <p className="text-sm font-medium">
                  {session.user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500">{session.user?.email}</p>
              </div>
            </div>

            {session.user?.role && (
              <Badge
                variant="secondary"
                className={`rounded-4xl text-[10px] w-fit ${getRoleBadgeColor(
                  session.user.role
                )}`}
              >
                <Shield className="w-3 h-3 mr-1" />
                {session.user.role}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="dark:bg-zinc-800" />

        {/* <Link href={"/dashboard/profile"}>
          <DropdownMenuItem className="cursor-pointer dark:hover:bg-zinc-800">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        </Link> */}

        <Link href={"/dashboard/settings"}>
          <DropdownMenuItem className="cursor-pointer dark:hover:bg-zinc-800">
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </DropdownMenuItem>
        </Link>

        {(session.user?.role === "ADMIN" ||
          session.user?.role === "MANAGER") && (
          <DropdownMenuItem>
            <UserCog className="mr-2 h-4 w-4" />
            <span>User Management</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <Link href="/dashboard/help-&-support">
          <DropdownMenuItem className="cursor-pointer dark:hover:bg-zinc-800">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help & Support</span>
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer group"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4 group-hover:text-red-500 transition" />
          <span className="group-hover:text-red-500 transition">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
