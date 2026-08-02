"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface Enterprise {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
}

export default function EnterpriseDashboard() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Assuming GET /api/v1/enterprise/ list endpoint exists or will be added
    apiFetch<{ data: Enterprise[] }>("/enterprise")
      .then((res) => setEnterprises(res.data))
      .catch((err) => console.error("Failed to fetch enterprises", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <h1 className="text-3xl font-semibold text-primary-900">Enterprise Management</h1>
      
      {loading ? (
        <div className="mt-6 animate-pulse space-y-4">
          <div className="h-10 w-full rounded bg-neutral-200" />
          <div className="h-40 w-full rounded bg-neutral-100" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Registered Enterprises</h2>
            {enterprises.length === 0 ? (
              <p className="text-neutral-500">No enterprises found.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {enterprises.map((ent) => (
                  <li key={ent.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-neutral-900">{ent.name}</p>
                      <p className="text-sm text-neutral-500">{ent.description}</p>
                    </div>
                    <button className="text-sm text-blue-600 hover:underline">View Details</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}