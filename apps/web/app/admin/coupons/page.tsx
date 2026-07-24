"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", discount_value: "", max_uses: "", expires_at: "" });

  useEffect(() => {
    apiFetch("/admin/coupons")
      .then(setCoupons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: form.code,
          discount_value: Number(form.discount_value),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          expires_at: form.expires_at || null,
        }),
      });
      const updated = await apiFetch("/admin/coupons");
      setCoupons(updated);
      setForm({ code: "", discount_value: "", max_uses: "", expires_at: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (id: string) => {
    await apiFetch(`/admin/coupons/${id}`, { method: "DELETE" });
    setCoupons(coupons.filter((c) => c.id !== id));
  };

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">Coupon management</h1>

        <Card className="mt-6 p-6">
          <h2 className="font-medium text-neutral-900">Add coupon</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input placeholder="Discount %" type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required />
            <Input placeholder="Max uses" type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
            <Input placeholder="Expires (ISO)" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            <Button type="submit" className="md:col-span-2 lg:col-span-1">Create</Button>
          </form>
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-medium text-neutral-900">Coupons</h2>
          {loading ? <p className="mt-3 text-neutral-600">Loading...</p> : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="pb-3 font-medium text-neutral-900">Code</th>
                  <th className="pb-3 font-medium text-neutral-900">Discount</th>
                  <th className="pb-3 font-medium text-neutral-900">Uses</th>
                  <th className="pb-3 font-medium text-neutral-900">Expires</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-100">
                    <td className="py-3 text-neutral-900">{c.code}</td>
                    <td className="py-3 text-neutral-600">{c.discount_value}%</td>
                    <td className="py-3 text-neutral-600">{c.used_count} / {c.max_uses ?? "∞"}</td>
                    <td className="py-3 text-neutral-600">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                    <td className="py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => remove(c.id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </section>
  );
}
