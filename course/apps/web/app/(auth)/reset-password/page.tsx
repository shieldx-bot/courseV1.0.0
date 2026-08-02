"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, token, new_password: password }),
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold text-primary-900">Set new password</h1>
      {success ? (
        <p className="mt-4 text-success">Password updated. Redirecting to login...</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-neutral-900">New password</label>
            <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-neutral-900">Confirm password</label>
            <Input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <Button type="submit" className="w-full">Update password</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-neutral-600">
        <Link href="/login" className="text-primary-700 hover:underline">Back to login</Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Suspense fallback={<Card className="w-full max-w-md p-8"><p>Loading...</p></Card>}>
        <ResetPasswordForm />
      </Suspense>
    </section>
  );
}
