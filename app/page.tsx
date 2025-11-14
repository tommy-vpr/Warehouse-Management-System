"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Import your form pages
import SignIn from "@/app/auth/signin/page";
import SignUp from "@/app/auth/signup/page";
import { ArrowLeft } from "lucide-react";

const Page = (props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  const [activeForm, setActiveForm] = useState<"signin" | "signup" | null>(
    null
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-tr from-[#020024] via-[#090979] to-[#00D4FF] flex justify-center items-center p-4">
      {/* Logo */}
      <Image
        src={"/images/headquarter-logo.webp"}
        className="absolute top-4 right-4 md:right-8 invert"
        width={40}
        height={40}
        alt="HQ logo"
      />

      <div className="w-full max-w-[1400px] flex flex-col-reverse lg:flex-row items-center gap-8 lg:gap-4">
        {/* Left Section with AnimatePresence */}
        <div className="w-full lg:w-1/2 xl:w-1/3 p-4 md:p-8 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeForm === null && (
              <motion.div
                key="marketing"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col"
              >
                <h1 className="hidden sm:inline-block text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-gray-100 mb-6 md:mb-12 font-semibold">
                  Warehouse Management System
                </h1>
                <p className="hidden sm:inline-block text-sm md:text-base text-gray-200 mb-6">
                  Streamline your operations with our modern Warehouse
                  Management System. From real-time inventory tracking to
                  automated order fulfillment and smart reporting, manage your
                  entire supply chain in one powerful, easy-to-use platform.
                </p>

                <div className="w-full flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={() => setActiveForm("signin")}
                    className="w-full sm:w-2/3 text-center py-3 md:py-2 px-6 rounded-4xl text-white font-semibold
                               bg-gradient-to-br from-violet-600 to-blue-600 
                               hover:-translate-y-0.5
                               hover:shadow-[0_0_20px_rgba(139,92,246,0.8)] transition-all duration-300 cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setActiveForm("signup")}
                    className="w-full sm:w-2/3 text-center py-3 md:py-2 px-6 rounded-4xl text-white font-semibold
                               bg-gradient-to-br from-orange-400 to-yellow-500 
                               hover:-translate-y-0.5
                               hover:shadow-[0_0_20px_rgba(251,191,36,0.8)] transition-all duration-300 cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              </motion.div>
            )}

            {activeForm === "signin" && (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col text-white w-full"
              >
                <SignIn />
                <button
                  onClick={() => setActiveForm(null)}
                  className="mt-4 text-gray-400 text-sm hover:text-gray-300 cursor-pointer flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </motion.div>
            )}

            {activeForm === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col text-white w-full"
              >
                <SignUp />
                <button
                  onClick={() => setActiveForm(null)}
                  className="mt-4 text-gray-400 text-sm hover:text-gray-300 cursor-pointer flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Section - Hidden on mobile when form is active */}
        <div
          className={`relative w-full lg:flex-1 h-[40vh] sm:h-[50vh] lg:h-[80vh] ${
            activeForm !== null ? "hidden lg:flex" : "flex"
          }`}
        >
          <Image
            src={"/images/warehouse-landing-banner-v2.webp"}
            alt="HQ warehouse management system"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default Page;
