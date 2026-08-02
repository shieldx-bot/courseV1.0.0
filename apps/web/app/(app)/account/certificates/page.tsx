"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { Certificate } from "@/types";

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.certificates.list()
      .then((data) => setCerts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">My certificates</h1>
        {loading ? (
          <p className="mt-6 text-neutral-600">Loading...</p>
        ) : certs.length === 0 ? (
          <Card className="mt-6 p-6">
            <p className="text-neutral-600">No certificates yet. Complete a course to earn one.</p>
            <Link href="/learn" className="mt-3 inline-block text-primary-700 hover:underline">
              Go to dashboard
            </Link>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certs.map((cert) => (
              <Card key={cert.id} className="p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🎓</span>
                  <div>
                    <p className="font-medium text-neutral-900 line-clamp-2">{cert.course_title}</p>
                    <p className="text-sm text-neutral-500">
                      {new Date(cert.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 mb-4">{cert.hours} hours of learning</p>
                <div className="mt-auto flex gap-2">
                  <a
                    href={apiClient.certificates.downloadUrl(cert.id)}
                    download
                    className="inline-flex items-center justify-center rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
                  >
                    Download PDF
                  </a>
                  <Link
                    href={`/verify/cert/${cert.verification_code}`}
                    className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Verify
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
