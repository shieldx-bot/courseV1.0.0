"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";

export function VerifyPhoneForm() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/learn";
  const { login, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.phone_verified && user?.trial_active) {
      router.replace(next || "/learn");
    }
  }, [user, router, next]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  if (user?.phone_verified && user?.trial_active) {
    return (
      <section className="flex flex-1 items-center justify-center py-16">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold text-primary-900">Already verified</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Your phone number is already verified. Redirecting...
          </p>
        </Card>
      </section>
    );
  }

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient.auth.otpRequest({ phone });
      setSent(true);
      setResendCooldown(30);
      toast("Code sent! Check your phone.", { type: "success" });
    } catch (e: any) {
      setError(e.message || "Could not send OTP. Please try again.");
      toast(e.message || "Could not send OTP", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    try {
      await apiClient.auth.otpRequest({ phone });
      setResendCooldown(30);
      toast("Code resent!", { type: "success" });
    } catch (e: any) {
      setError(e.message || "Could not resend OTP. Please try again.");
      toast(e.message || "Could not resend OTP", { type: "error" });
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.auth.otpVerify({ phone, code });
      if (res.user) {
        login(res.user);
      }
      toast("Phone verified! Welcome to Ascendly.", { type: "success" });
      router.push(next);
    } catch (e: any) {
      setError(e.message || "Invalid code. Please try again.");
      toast(e.message || "Invalid code", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-primary-900">Verify your phone</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Verify your phone number to unlock a 3-day, 10% preview of any course.
        </p>
        {error && <p className="mt-4 text-sm text-error" role="alert">{error}</p>}
        {!sent ? (
          <form onSubmit={requestOtp} className="mt-6 space-y-4">
            <Input
              label="Phone number"
              type="tel"
              inputMode="numeric"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              error={error}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <Input
              label="Verification code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              error={error}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify and start preview"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={resendOtp}
                disabled={resendCooldown > 0}
                className="text-sm text-primary-700 hover:underline disabled:text-neutral-400 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
