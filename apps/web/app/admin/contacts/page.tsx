"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface Contact {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/admin/contacts")
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">Contact messages</h1>
        <Card className="mt-6 p-6">
          {loading ? (
            <p className="text-neutral-600">Loading...</p>
          ) : contacts.length === 0 ? (
            <p className="text-neutral-600">No messages yet.</p>
          ) : (
            <ul className="space-y-4">
              {contacts.map((c) => (
                <li key={c.id} className="border-b border-neutral-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-neutral-900">{c.name}</p>
                    <span className="text-xs text-neutral-600">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-neutral-600">{c.email}</p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">{c.subject}</p>
                  <p className="mt-1 text-sm text-neutral-600">{c.message}</p>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </Card>
      </div>
    </section>
  );
}
