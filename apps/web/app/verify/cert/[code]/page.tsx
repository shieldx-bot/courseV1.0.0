"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { CertificateVerification } from "@/types";

export default function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.certificates.verify(code)
      .then(setResult)
      .catch(() => setResult({ valid: false, verification_code: code }))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <section className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="mx-auto max-w-lg px-6 text-center">
        {loading ? (
          <p className="text-neutral-600">Verifying...</p>
        ) : !result?.valid ? (
          <Card className="p-8">
            <span className="text-5xl">❌</span>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-900">Certificate not found</h1>
            <p className="mt-2 text-neutral-600">
              This verification code does not match any valid certificate.
            </p>
            <p className="mt-4 text-sm text-neutral-400">Code: {code}</p>
          </Card>
        ) : (
          <Card className="p-8">
            <span className="text-5xl">🎓</span>
            <h1 className="mt-4 text-2xl font-semibold text-primary-900">Valid certificate</h1>
            <div className="mt-6 space-y-2 text-left">
              <p className="text-neutral-600">This certifies that</p>
              <p className="text-xl font-bold text-primary-700">{result.user_name}</p>
              <p className="text-neutral-600">has successfully completed</p>
              <p className="text-lg font-semibold text-neutral-900">{result.course_title}</p>
              <p className="text-sm text-neutral-500">
                Completed on {result.completed_at ? new Date(result.completed_at).toLocaleDateString() : ""}
              </p>
              <p className="text-sm text-neutral-500">{result.hours} hours of learning</p>
              <p className="mt-4 text-xs text-neutral-400">Verification code: {result.verification_code}</p>
            </div>
            <p className="mt-6 text-sm text-success">✓ This certificate is authentic and verified</p>
          </Card>
        )}
      </div>
    </section>
  );
}
