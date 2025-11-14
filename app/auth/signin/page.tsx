"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Eye, EyeOff, Clock } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimitExpiry, setRateLimitExpiry] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  const { toast } = useToast();

  // Countdown timer effect
  useEffect(() => {
    if (!rateLimitExpiry) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((rateLimitExpiry - now) / 1000));

      setCountdown(remaining);

      if (remaining === 0) {
        setRateLimitExpiry(null);
        setError("");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitExpiry]);

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("Too many login attempts")) {
          // Set rate limit expiry to 15 minutes from now
          const expiryTime = Date.now() + 60 * 1000;
          setRateLimitExpiry(expiryTime);
          setError("Too many login attempts. Please wait before trying again.");
        } else if (result.error.includes("verify your email")) {
          setError("Please verify your email before signing in.");
        } else {
          setError("Invalid email or password. Please try again.");
        }
      } else if (result?.ok) {
        toast({
          title: "Logged in!",
          variant: "success",
        });
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isRateLimited = rateLimitExpiry && countdown > 0;

  return (
    <div className="flex items-center justify-center">
      <Card
        className="w-full max-w-md 
             bg-white/10 backdrop-blur-xl 
             border border-white/20 
             shadow-xl rounded-2xl 
             text-gray-100"
      >
        <CardHeader className="space-y-1 text-center">
          <div className="relative w-16 h-16 m-auto">
            <Image
              src="/images/headquarter-logo.webp"
              alt="HQ warehouse management"
              fill
              className="object-contain drop-shadow-lg invert"
              sizes="64px"
            />
          </div>
          <CardTitle className="text-xl text-white">
            Sign into your account
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center space-x-2 text-red-400 bg-red-700/10 p-3 rounded-md border border-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {isRateLimited && (
            <div className="flex items-center justify-center space-x-2 text-orange-400 bg-orange-700/10 p-3 rounded-md border border-orange-400">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                Try again in {formatCountdown(countdown)}
              </span>
            </div>
          )}

          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-100">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || !!isRateLimited}
                className="text-sm bg-white/10 border border-white/20 text-white placeholder:text-gray-400
                     focus:ring-2 focus:ring-blue-400 focus:outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-100">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || !!isRateLimited}
                  className="text-sm bg-white/10 border border-white/20 text-white placeholder:text-gray-400
                       focus:ring-2 focus:ring-blue-400 focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || !!isRateLimited}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="cursor-pointer w-full bg-gradient-to-r from-blue-500 to-violet-500 
                   text-white font-semibold rounded-xl py-2 
                   hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] 
                   transition-all duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              disabled={isLoading || !!isRateLimited}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isRateLimited ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Locked ({formatCountdown(countdown)})
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
