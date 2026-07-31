"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/types";
import { GoogleLogin } from "@react-oauth/google";
import { useToast } from "@/components/ui/toast";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      toast("Passwords do not match", { type: "error" });
      return;
    }
    try {
      const data = await apiFetch<{ user: User }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      login(data.user);
      toast("Account created! Please verify your phone.", { type: "success" });
      router.push("/verify-phone");
    } catch (err: any) {
      setError(err.message);
      toast(err.message, { type: "error" });
    }
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) return;
    try {
      const data = await apiFetch<{ user: User }>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      login(data.user);
      toast("Account created! Please verify your phone.", { type: "success" });
      router.push("/verify-phone");
    } catch (err: any) {
      setError(err.message);
      toast(err.message, { type: "error" });
    }
  };

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-primary-900">Create your free account</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            id="signup-name"
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            error={error}
          />
          <Input
            id="signup-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            error={error}
          />
          <Input
            id="signup-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            error={error}
          />
          <Input
            id="signup-confirm"
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            error={error}
          />
          <Button type="submit" className="w-full">Create account</Button>
        </form>

        <div className="my-4 text-center text-sm text-neutral-600">or</div>
        <div className="flex justify-center">
          <GoogleLogin onSuccess={handleGoogle} onError={() => { setError("Google sign-in failed"); toast("Google sign-in failed", { type: "error" }); }} text="signup_with" />
        </div>

        <p className="mt-4 text-center text-sm text-neutral-600">
          Already have an account? <Link href="/login" className="text-primary-700 hover:underline">Log in</Link>
        </p>
      </Card>
    </section>
  );
}
