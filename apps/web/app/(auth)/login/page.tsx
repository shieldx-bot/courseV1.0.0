"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { GoogleLogin } from "@react-oauth/google";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiClient.auth.login({ email, password });
      login(data.user);
      toast("Welcome back!", { type: "success" });
      router.push("/learn");
    } catch (err: any) {
      setError(err.message);
      toast(err.message, { type: "error" });
    }
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) return;
    try {
      const data = await apiClient.auth.googleLogin({ token: credentialResponse.credential });
      login(data.user);
      toast("Welcome back!", { type: "success" });
      router.push("/learn");
    } catch (err: any) {
      setError(err.message);
      toast(err.message, { type: "error" });
    }
  };

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-primary-900">Log in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            error={error}
          />
          <Input
            id="login-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            error={error}
          />
          <Button type="submit" className="w-full">Log in</Button>
        </form>

        <div className="my-4 text-center text-sm text-neutral-600">or</div>
        <div className="flex justify-center">
          <GoogleLogin onSuccess={handleGoogle} onError={() => setError("Google sign-in failed")} text="signin_with" />
        </div>

        <p className="mt-4 text-center text-sm text-neutral-600">
          <Link href="/forgot-password" className="text-primary-700 hover:underline">Forgot password?</Link>
        </p>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Don&apos;t have an account? <Link href="/signup" className="text-primary-700 hover:underline">Sign up</Link>
        </p>
      </Card>
    </section>
  );
}
