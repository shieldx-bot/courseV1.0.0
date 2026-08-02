"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/contact", { method: "POST", body: JSON.stringify(form) });
      setSubmitted(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <section className="py-16">
      <div className="mx-auto max-w-xl px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Contact us</h1>
        <p className="mt-2 text-neutral-600">Questions about Ascendly? Send us a message and we will reply within one business day.</p>
        <Card className="mt-8 p-6">
          {submitted ? (
            <p className="text-success">Thanks for reaching out. We will get back to you soon.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-neutral-900">Name</label>
                <Input id="contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-neutral-900">Email</label>
                <Input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
              </div>
              <div>
                <label htmlFor="contact-subject" className="block text-sm font-medium text-neutral-900">Subject</label>
                <Input id="contact-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" required />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-900">Message</label>
                <textarea
                  id="contact-message"
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-neutral-300 p-3 text-sm text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                  placeholder="Tell us more..."
                  required
                />
              </div>
              <Button type="submit" className="w-full">Send message</Button>
              {error && <p className="text-sm text-error" role="alert">{error}</p>}
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}
