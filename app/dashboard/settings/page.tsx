"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Lock,
  LoaderCircle,
  Eye,
  EyeOff,
  Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UpdateProfileData {
  name?: string;
  email?: string;
}

interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function UserSettingsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { data: session, update: updateSession } = useSession();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Update inputs when session loads
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  // Helper function to get initials
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "avatar");

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload avatar");
      }

      const data = await response.json();

      // Update session with new image
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          image: data.imageUrl,
        },
      });

      toast({
        title: "Success",
        description: "Profile picture updated",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Update session with new data
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: data.name,
          email: data.email,
        },
      });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: UpdatePasswordData) => {
      const response = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update password");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Error",
        description: "Valid email is required",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({ name, email });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "New password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    updatePasswordMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  // Show loading while session loads
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoaderCircle className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage your account information and security
          </p>
        </div>

        {/* Avatar Section */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="relative flex-shrink-0">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    {getInitials(session?.user?.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Upload button overlay */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 rounded-full p-2 cursor-pointer text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
                >
                  {uploadingAvatar ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 mb-1">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white">
                    {session?.user?.name}
                  </h3>
                  <Badge className="rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    {session?.user?.role || "Staff"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {session?.user?.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Click the camera icon to change your profile picture. JPG, GIF
                  or PNG. Max size 5MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-sm">
              Update your name and email address
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={updateProfileMutation.isPending}
                  className="dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  disabled={updateProfileMutation.isPending}
                  className="dark:border-zinc-700"
                />
              </div>

              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full sm:w-auto text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              Change Password
            </CardTitle>
            <CardDescription className="text-sm">
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={updatePasswordMutation.isPending}
                    className="pr-10 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                    disabled={updatePasswordMutation.isPending}
                    className="pr-10 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={updatePasswordMutation.isPending}
                    className="pr-10 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Password Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>At least 8 characters long</li>
                    <li>Mix of letters, numbers recommended</li>
                  </ul>
                </div>
              </div>

              <Button
                type="submit"
                disabled={updatePasswordMutation.isPending}
                className="w-full sm:w-auto text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {updatePasswordMutation.isPending ? (
                  <>
                    <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">
              Account Information
            </CardTitle>
            <CardDescription className="text-sm">
              Details about your account
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-600 dark:text-gray-400">
                  User ID:
                </span>
                <span className="font-mono text-xs break-all sm:break-normal">
                  {session?.user?.id}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-600 dark:text-gray-400">Role:</span>
                <Badge variant="outline" className="w-fit">
                  {session?.user?.role || "Staff"}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-600 dark:text-gray-400">
                  Account Created:
                </span>
                <span>Recently</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
