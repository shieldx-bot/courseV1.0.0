"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { Subscription } from "@/types";
import { useToast } from "@/components/ui/toast";

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pwd, setPwd] = useState({ old: "", new: "", confirm: "" });
  const [pwdError, setPwdError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const { toast } = useToast();

  const trialActive = !!user?.trial_active && !!user?.trial_expires && new Date(user.trial_expires) > new Date();
  let trialDaysLeft = 0;
  if (trialActive && user?.trial_expires) {
    trialDaysLeft = Math.max(0, Math.ceil((new Date(user.trial_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  useEffect(() => {
    setLoading(true);
    apiClient.subscriptions.me()
      .then((data) => setSub(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiClient.auth.updateProfile({ name });
      updateUser(updated.user);
      toast("Profile updated.", { type: "success" });
    } catch (e: any) {
      toast(e.message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (pwd.new !== pwd.confirm) {
      setPwdError("Passwords do not match");
      toast("Passwords do not match", { type: "error" });
      return;
    }
    try {
      await apiClient.auth.changePassword({ old_password: pwd.old, new_password: pwd.new });
      setPwd({ old: "", new: "", confirm: "" });
      toast("Password updated.", { type: "success" });
    } catch (e: any) {
      setPwdError(e.message);
      toast(e.message, { type: "error" });
    }
  };

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      await apiClient.subscriptions.cancel();
      setSub(null);
      setCancelConfirm(false);
      toast("Subscription canceled.", { type: "success" });
    } catch (e: any) {
      toast(e.message, { type: "error" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Account</h1>

        {trialActive && !sub && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              Your free preview ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}.
              <Link href="/pricing" className="ml-1 font-medium underline hover:text-amber-900">
                Subscribe to keep learning
              </Link>
            </span>
          </div>
        )}

        <Card className="mt-6 p-6">
          {loading ? (
            <p className="text-neutral-600">Loading...</p>
          ) : sub ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-600">Current plan</p>
                <p className="text-lg font-medium text-neutral-900">{sub.tier} membership</p>
                <p className="text-sm text-neutral-600">Valid until {new Date(sub.ends_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="success">{sub.status}</Badge>
                {!cancelConfirm ? (
                  <Button variant="secondary" size="sm" onClick={() => setCancelConfirm(true)}>
                    Cancel subscription
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-error">Are you sure?</p>
                    <Button size="sm" variant="secondary" onClick={() => setCancelConfirm(false)}>Keep</Button>
                    <Button size="sm" variant="danger" onClick={cancelSubscription} disabled={cancelling}>
                      {cancelling ? "Cancelling..." : "Confirm cancel"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-neutral-600">No active membership.</p>
              <Link href="/pricing" className="mt-2 inline-block text-primary-700 hover:underline">View plans</Link>
            </div>
          )}
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-primary-900">Profile</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <Input label="Email" value={user?.email} disabled />
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
          </form>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-primary-900">Change password</h2>
          <form onSubmit={changePassword} className="mt-4 space-y-4">
            <Input label="Current password" type="password" value={pwd.old} onChange={(e) => setPwd({ ...pwd, old: e.target.value })} required />
            <Input label="New password" type="password" value={pwd.new} onChange={(e) => setPwd({ ...pwd, new: e.target.value })} required />
            <Input label="Confirm new password" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
            <Button type="submit">Update password</Button>
            {pwdError && <p className="text-sm text-error">{pwdError}</p>}
          </form>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-primary-900">Certificates</h2>
          <p className="mt-1 text-sm text-neutral-600">View and download your course completion certificates.</p>
          <Link href="/account/certificates" className="mt-3 inline-block rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
            My certificates
          </Link>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-primary-900">Write a review</h2>
          <p className="mt-1 text-sm text-neutral-600">Share your experience with other members.</p>
          <ReviewForm />
        </Card>

        <Button variant="secondary" className="mt-6" onClick={handleLogout}>Log out</Button>
      </div>
    </section>
  );
}

function ReviewForm() {
  const [form, setForm] = useState({ name: "", role: "", rating: 5, outcome: "", quote: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr("");
    try {
      await apiClient.reviews.create(form);
      setDone(true);
      setForm({ name: "", role: "", rating: 5, outcome: "", quote: "" });
      toast("Thank you! Your review has been submitted.", { type: "success" });
    } catch (e: any) {
      setErr(e.message);
      toast(e.message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <p className="mt-3 text-sm text-success">Thank you! Your review has been submitted.</p>;

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Your name" />
        <Input label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required placeholder="e.g. Data Analyst" />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-900">Rating</label>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setForm({ ...form, rating: star })}
              className={`h-6 w-6 ${star <= form.rating ? "text-accent-500" : "text-neutral-300"}`}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <Input label="Outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} required placeholder="What did you achieve?" />
      <Input label="Quote" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} required placeholder="Share your experience..." />
      <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit review"}</Button>
      {err && <p className="text-sm text-error">{err}</p>}
    </form>
  );
}
