"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface Order {
  id: string;
  amount: number;
  currency: string;
  payment_provider: string;
  coupon_code: string | null;
  created_at: string;
}

export default function BillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/subscriptions/orders")
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Billing history</h1>
        <Card className="mt-6 p-6">
          {loading ? (
            <p className="text-neutral-600">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-neutral-600">No payments yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="pb-3 font-medium text-neutral-900">Invoice</th>
                  <th className="pb-3 font-medium text-neutral-900">Date</th>
                  <th className="pb-3 font-medium text-neutral-900">Provider</th>
                  <th className="pb-3 font-medium text-neutral-900">Coupon</th>
                  <th className="pb-3 font-medium text-neutral-900">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-100">
                    <td className="py-3 text-neutral-900">{o.id}</td>
                    <td className="py-3 text-neutral-600">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                    <td className="py-3 text-neutral-600">{o.payment_provider}</td>
                    <td className="py-3 text-neutral-600">{o.coupon_code || "—"}</td>
                    <td className="py-3 text-neutral-900">${o.amount}</td>
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
