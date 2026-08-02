"use client";

import { Suspense } from "react";
import { VerifyPhoneForm } from "./verify-phone-form";

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center">Loading...</p>}>
      <VerifyPhoneForm />
    </Suspense>
  );
}
