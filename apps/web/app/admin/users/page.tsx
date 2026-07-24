"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

interface Tier {
  id: string;
  label: string;
  duration_months: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone_verified: boolean;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [override, setOverride] = useState({ tier_id: "", duration_months: "1" });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    const u = await apiFetch(`/admin/users?${params.toString()}`);
    setUsers(u);
  }, [search, roleFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), apiFetch("/subscriptions/tiers")])
      .then(([_, t]) => setTiers(t))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchUsers]);

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiFetch(`/admin/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editing.name, role: editing.role }),
      });
      await fetchUsers();
      setEditing(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const grantSubscription = async (userId: string) => {
    setError("");
    try {
      await apiFetch(`/admin/users/${userId}/subscription`, {
        method: "POST",
        body: JSON.stringify({ tier_id: override.tier_id, duration_months: Number(override.duration_months) }),
      });
      toast("Subscription granted", "success");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const cancelSubscription = async (userId: string) => {
    setError("");
    try {
      await apiFetch(`/admin/users/${userId}/subscription`, { method: "DELETE" });
      toast("Subscription canceled", "success");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">User management</h1>

        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            aria-label="Search users"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-neutral-300 p-2 text-sm"
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <Card className="mt-4 p-6">
          {loading ? <p className="text-neutral-600">Loading...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="pb-3 font-medium text-neutral-900">Email</th>
                    <th className="pb-3 font-medium text-neutral-900">Name</th>
                    <th className="pb-3 font-medium text-neutral-900">Role</th>
                    <th className="pb-3 font-medium text-neutral-900">Phone verified</th>
                    <th className="pb-3 font-medium text-neutral-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-100">
                      <td className="py-3 text-neutral-900">{u.email}</td>
                      <td className="py-3 text-neutral-600">{u.name}</td>
                      <td className="py-3 text-neutral-600">{u.role}</td>
                      <td className="py-3 text-neutral-600">{u.phone_verified ? "Yes" : "No"}</td>
                      <td className="py-3">
                        <Button size="sm" onClick={() => setEditing(u)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="py-4 text-center text-neutral-500">No users found.</p>}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </Card>

        {editing && (
          <Card className="mt-6 p-6">
            <h2 className="font-medium text-neutral-900">Edit {editing.email}</h2>
            <form onSubmit={saveUser} className="mt-4 grid gap-4 md:grid-cols-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Name" aria-label="User name" />
              <Input value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="Role" aria-label="User role" />
              <Button type="submit">Save</Button>
            </form>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <select
                value={override.tier_id}
                onChange={(e) => setOverride({ ...override, tier_id: e.target.value })}
                className="rounded-md border border-neutral-300 p-2 text-sm"
                aria-label="Select tier"
              >
                <option value="">Select tier</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} ({t.duration_months} mo)</option>
                ))}
              </select>
              <Input type="number" value={override.duration_months} onChange={(e) => setOverride({ ...override, duration_months: e.target.value })} placeholder="Months" aria-label="Duration months" />
              <Button onClick={() => grantSubscription(editing.id)}>Grant subscription</Button>
              <Button variant="secondary" onClick={() => cancelSubscription(editing.id)}>Cancel subscription</Button>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
