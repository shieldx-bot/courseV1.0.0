"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-primary-900">Reset password</h1>
        {submitted ? (
          <p className="mt-4 text-success">If an account exists, a reset link has been sent to {email}.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-neutral-900">Email</label>
              <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-error" role="alert">{error}</p>}
            <Button type="submit" className="w-full">Send reset link</Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-neutral-600">
          Remember your password? <Link href="/login" className="text-primary-700 hover:underline">Log in</Link>
        </p>
      </Card>
    </section>
  );
}
