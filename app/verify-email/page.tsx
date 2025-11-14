// app/verify-email/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// -------------------------
// PAGE WRAPPED IN SUSPENSE
// -------------------------
export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

// -------------------------
// ACTUAL CLIENT COMPONENT
// -------------------------
function VerifyEmailContent() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage("Email verified successfully! You can now sign in.");
          setTimeout(() => router.push("/"), 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred");
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-tr from-[#020024] via-[#090979] to-[#00D4FF]">
      <Card className="w-full max-w-md bg-white border border-white/20 shadow-xl rounded-2xl text-gray-100">
        <CardHeader className="text-center">
          <div className="relative w-16 h-16 m-auto mb-4">
            <Image
              src="/images/headquarter-logo.webp"
              alt="HQ warehouse management"
              fill
              className="object-contain drop-shadow-lg"
              sizes="64px"
            />
          </div>
          <CardTitle className="text-2xl text-white">
            Email Verification
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
              <p className="text-gray-300">Verifying your email...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="bg-green-500/10 p-4 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-green-500 text-center">{message}</p>
              <p className="text-sm text-gray-400">Redirecting to sign in...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="bg-red-500/10 p-4 rounded-full">
                <XCircle className="h-12 w-12 text-red-400" />
              </div>
              <p className="text-red-300 text-center">{message}</p>
              <Link href="/">
                <Button className="rounded-full mt-4 bg-gradient-to-r from-blue-500 to-violet-500 text-white">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
