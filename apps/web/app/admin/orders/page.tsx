"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

interface Order {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_provider: string;
  payment_status: string;
  coupon_code: string | null;
  created_at: string;
  refunded_at?: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (providerFilter) params.set("provider", providerFilter);
    return apiFetch<Order[]>(`/admin/orders?${params.toString()}`);
  }, [search, statusFilter, providerFilter]);

  useEffect(() => {
    setLoading(true);
    fetchOrders()
      .then((data) => setOrders(data as any))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchOrders]);

  const refund = async (id: string) => {
    setRefunding(id);
    setError("");
    try {
      await apiFetch(`/admin/orders/${id}/refund`, { method: "POST" });
      const updated = await fetchOrders();
      setOrders(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefunding(null);
    }
  };

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">Orders</h1>

        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search by order or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            aria-label="Search orders"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-neutral-300 p-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-md border border-neutral-300 p-2 text-sm"
            aria-label="Filter by provider"
          >
            <option value="">All providers</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="test">Test</option>
          </select>
        </div>

        <Card className="mt-4 p-6">
          {loading ? <p className="text-neutral-600">Loading...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="pb-3 font-medium text-neutral-900">ID</th>
                    <th className="pb-3 font-medium text-neutral-900">User</th>
                    <th className="pb-3 font-medium text-neutral-900">Amount</th>
                    <th className="pb-3 font-medium text-neutral-900">Provider</th>
                    <th className="pb-3 font-medium text-neutral-900">Status</th>
                    <th className="pb-3 font-medium text-neutral-900">Coupon</th>
                    <th className="pb-3 font-medium text-neutral-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-neutral-100">
                      <td className="py-3 text-neutral-900">{o.id.slice(0, 20)}...</td>
                      <td className="py-3 text-neutral-600">{o.user_id}</td>
                      <td className="py-3 text-neutral-600">${o.amount}</td>
                      <td className="py-3 text-neutral-600">{o.payment_provider}</td>
                      <td className="py-3 text-neutral-600">{o.payment_status}</td>
                      <td className="py-3 text-neutral-600">{o.coupon_code || "—"}</td>
                      <td className="py-3">
                        {o.payment_status !== "refunded" && (
                          <Button size="sm" onClick={() => refund(o.id)} disabled={refunding === o.id}>
                            {refunding === o.id ? "Refunding..." : "Refund"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <p className="py-4 text-center text-neutral-500">No orders found.</p>}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </Card>
      </div>
    </section>
  );
}
