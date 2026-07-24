"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { GoogleLogin } from "@react-oauth/google";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      const data = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      login(data.user);
      router.push("/verify-phone");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogle = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) return;
    try {
      const data = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      login(data.user);
      router.push("/verify-phone");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-primary-900">Create your free account</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-neutral-900">Name</label>
            <Input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-900">Email</label>
            <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-900">Password</label>
            <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="signup-confirm" className="block text-sm font-medium text-neutral-900">Confirm password</label>
            <Input id="signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <Button type="submit" className="w-full">Create account</Button>
        </form>

        <div className="my-4 text-center text-sm text-neutral-600">or</div>
        <div className="flex justify-center">
          <GoogleLogin onSuccess={handleGoogle} onError={() => setError("Google sign-in failed")} text="signup_with" />
        </div>

        <p className="mt-4 text-center text-sm text-neutral-600">
          Already have an account? <Link href="/login" className="text-primary-700 hover:underline">Log in</Link>
        </p>
      </Card>
    </section>
  );
}
