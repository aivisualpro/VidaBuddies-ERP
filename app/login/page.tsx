"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PageMode = "login" | "forgot" | "verify";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PageMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA State
  const [verificationToken, setVerificationToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-focus first OTP input when entering verify mode
  useEffect(() => {
    if (mode === "verify") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        keepalive: true,
        cache: 'no-store'
      });

      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        throw new Error("Server returned non-JSON response. The server might be restarting or timing out.");
      }

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(result.error || "Your account is inactive. Please contact your administrator.");
        } else if (response.status === 401) {
          toast.error("Invalid email or password. Please check your credentials.");
        } else {
          toast.error(result.error || "An error occurred during login.");
        }
        setIsLoading(false);
        return;
      }
      
      // Check if 2FA verification is required
      if (result.requiresVerification) {
        setVerificationToken(result.verificationToken);
        setMaskedEmail(result.maskedEmail);
        setOtpValues(["", "", "", "", "", ""]);
        setCountdown(60);
        setMode("verify");
        toast.success("Verification code sent to your email");
      } else {
        // Direct login (fallback if 2FA is disabled)
        toast.success(`Welcome back, ${result.user.name}`);
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("[Login Error]", err);
      if (err.name === 'AbortError' || err.message === 'Failed to fetch') {
        toast.error("Network error or connection lost. Please refresh the page and try again.");
      } else {
        toast.error(err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1); // Only take last character
    setOtpValues(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newOtp.every(v => v !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 0) return;

    const newOtp = [...otpValues];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtpValues(newOtp);

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex(v => v === "");
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    // Auto-submit if all filled
    if (newOtp.every(v => v !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride || otpValues.join("");
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, verificationToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Verification failed");
        if (response.status === 410 || response.status === 429 || response.status === 401 && result.error?.includes("expired")) {
          // Code expired or too many attempts - go back to login
          setMode("login");
        } else {
          // Wrong code - clear and let them retry
          setOtpValues(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
        return;
      }

      toast.success(`Welcome back, ${result.user.name}`);
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    // Re-submit login to get a new code
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (response.ok && result.requiresVerification) {
        setVerificationToken(result.verificationToken);
        setOtpValues(["", "", "", "", "", ""]);
        setCountdown(60);
        toast.success("New verification code sent");
        inputRefs.current[0]?.focus();
      } else {
        toast.error(result.error || "Failed to resend code");
      }
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message);
        setMode("login");
      } else {
        toast.error(result.error || "Something went wrong");
      }
    } catch (err) {
      toast.error("Failed to send recovery email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="relative group animate-float">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <Image
              src="/logo.png"
              alt="Logo"
              width={100}
              height={100}
              className="relative object-contain w-24 h-24 drop-shadow-2xl transition-transform duration-500 hover:scale-110"
              priority
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent text-center">
            {mode === "forgot" ? "Recover Password" : mode === "verify" ? "Two-Factor Auth" : "Welcome Back"}
          </h1>
          <p className="text-zinc-500 mt-2 text-sm font-light text-center">
            {mode === "forgot" 
              ? "Submit your email and we'll send your password" 
              : mode === "verify"
              ? `Enter the 6-digit code sent to ${maskedEmail}`
              : "Enter your credentials to access your account"}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl">
          {/* ─── VERIFY MODE ─── */}
          {mode === "verify" && (
            <div className="space-y-8">
              {/* Shield Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-zinc-800 border border-zinc-700 rounded-full p-4">
                    <ShieldCheck className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* OTP Inputs */}
              <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`
                      w-12 h-14 text-center text-xl font-bold rounded-xl 
                      bg-zinc-950/80 border-2 transition-all duration-200 outline-none
                      text-zinc-100 caret-primary
                      ${value 
                        ? "border-primary/60 shadow-[0_0_12px_rgba(var(--primary-rgb,124,58,237),0.15)]" 
                        : "border-zinc-800 hover:border-zinc-700"
                      }
                      focus:border-primary focus:shadow-[0_0_20px_rgba(var(--primary-rgb,124,58,237),0.25)]
                    `}
                    disabled={isVerifying}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <Button
                onClick={() => handleVerify()}
                disabled={isVerifying || otpValues.some(v => !v)}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Verifying...
                  </span>
                ) : "Verify & Login"}
              </Button>

              {/* Resend & Back */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setOtpValues(["", "", "", "", "", ""]); }}
                  className="text-xs text-zinc-500 hover:text-primary transition-colors font-medium flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Login
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || isLoading}
                  className={`text-xs font-medium transition-colors ${
                    countdown > 0 
                      ? "text-zinc-600 cursor-not-allowed" 
                      : "text-primary hover:text-primary/80 cursor-pointer"
                  }`}
                >
                  {countdown > 0 
                    ? `Resend in ${countdown}s` 
                    : isLoading ? "Sending..." : "Resend Code"
                  }
                </button>
              </div>
            </div>
          )}

          {/* ─── FORGOT MODE ─── */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-widest font-semibold ml-1">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="bg-zinc-950/50 border-zinc-800 h-12 pl-11 focus:ring-1 focus:ring-primary/50 transition-all rounded-xl text-zinc-200"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
              >
                {isSubmitting ? "Sending..." : "Send Password"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-zinc-500 hover:text-primary transition-colors font-medium"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* ─── LOGIN MODE ─── */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-widest font-semibold ml-1">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="bg-zinc-950/50 border-zinc-800 h-12 pl-11 focus:ring-1 focus:ring-primary/50 transition-all rounded-xl text-zinc-200"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-widest font-semibold ml-1">
                    Password
                  </Label>
                  <button 
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[11px] text-zinc-500 hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="bg-zinc-950/50 border-zinc-800 h-12 pl-11 pr-11 focus:ring-1 focus:ring-primary/50 transition-all rounded-xl text-zinc-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
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
                disabled={isLoading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
              >
                {isLoading ? "Logging in..." : "Log In"}
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-zinc-500 text-xs">
              Don't have an account?{" "}
              <a href="#" className="text-primary hover:underline font-semibold">
                Contact your administrator
              </a>
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-12 mb-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-medium z-10">
        © {new Date().getFullYear()} Vida Buddies. All rights reserved.
      </footer>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
