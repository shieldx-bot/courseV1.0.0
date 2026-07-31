"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { SubscriptionTier, CheckoutSessionResponse } from "@/types";
import { useToast } from "@/components/ui/toast";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-neutral-600">Loading...</p>}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tierId = searchParams.get("tier") || "tier-1mo";
  const paypalOrderId = searchParams.get("paypal_order_id");
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const providerParam = searchParams.get("provider") as "stripe" | "paypal" | null;
  const { toast } = useToast();

  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ discount_value: number } | null>(null);
  const [provider, setProvider] = useState<"stripe" | "paypal">(providerParam || "stripe");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCoupon, setShowCoupon] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap for confirmation modal
  useEffect(() => {
    if (confirming && modalRef.current) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusableElements || focusableElements.length === 0) return;
          
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
        if (e.key === 'Escape') {
          handleCancelConfirm();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [confirming]);

  useEffect(() => {
    apiClient.subscriptions.tiers()
      .then((tiers) => setTier(tiers.find((t: SubscriptionTier) => t.id === tierId) || tiers[0]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tierId]);

  // Forward declaration to avoid circular dependency
  const verifyAndRedirect = async () => {
    setVerifying(true);
    try {
      await apiClient.subscriptions.me();
      const t = setTimeout(() => router.push("/learn"), 2000);
      return () => clearTimeout(t);
    } catch {
      setError("Payment was processed but we could not verify your subscription. Please contact support.");
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (canceled) return;
    if (success) {
      const isPaypal = providerParam === "paypal" || paypalOrderId;
      if (isPaypal) {
        const orderId = paypalOrderId || sessionStorage.getItem("paypal_order_id");
        if (orderId) {
          setSubmitting(true);
          apiClient.checkout.paypalCapture(orderId)
            .then(() => {
              sessionStorage.removeItem("paypal_order_id");
              verifyAndRedirect();
            })
            .catch((e) => {
              setError(e.message || "PayPal confirmation failed. Please contact support.");
              setCaptureFailed(true);
              setSubmitting(false);
            });
          return;
        }
        setError("Missing PayPal order ID. Please contact support.");
        setSubmitting(false);
        return;
      }
      verifyAndRedirect();
      return;
    }
  }, [success, paypalOrderId, providerParam, canceled, router, verifyAndRedirect]);

  const apply = async () => {
    setError("");
    try {
      const c = await apiClient.subscriptions.coupon(code);
      setCoupon(c);
      toast("Coupon applied!", { type: "success" });
    } catch {
      setCoupon(null);
      setError("That code isn't valid or has expired.");
      toast("That code isn't valid or has expired.", { type: "error" });
    }
  };

  const basePrice = (() => {
    if (!tier) return 0;
    return tier.duration_months >= 999 ? 999 : tier.price_per_month * tier.duration_months;
  })();

  const total = (() => {
    if (coupon) return Math.round(basePrice * (1 - coupon.discount_value / 100));
    return basePrice;
  })();

  const pay = async () => {
    setError("");
    setCaptureFailed(false);
    setSubmitting(true);
    try {
      if (!tier?.id) {
        setError("Please select a subscription tier");
        toast("Please select a subscription tier", { type: "error" });
        setSubmitting(false);
        return;
      }
      const data = await apiClient.checkout.createSession({
        tier_id: tier.id, coupon_code: code || null, payment_provider: provider,
      }) as CheckoutSessionResponse;
      if (data.provider === "paypal" && data.order?.approval_url) {
        sessionStorage.setItem("paypal_order_id", data.order.order_id);
        window.location.href = data.order.approval_url;
        return;
      }
      if (data.session_url) {
        window.location.href = data.session_url;
      }
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
      setSubmitting(false);
    }
  };

  const handleSubscribe = () => {
    setConfirming(true);
  };

  const handleConfirm = () => {
    setConfirming(false);
    pay();
  };

  const handleCancelConfirm = () => {
    setConfirming(false);
  };

  if (verifying) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">Verifying your subscription...</h1>
        <p className="mt-2 text-neutral-600">Please wait while we confirm your payment.</p>
      </section>
    );
  }

  if (success && !submitting && !captureFailed && !verifying) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">Payment successful</h1>
        <p className="mt-2 text-neutral-600">Redirecting you to your learning dashboard...</p>
      </section>
    );
  }

  if (submitting) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">
          {providerParam === "paypal" || paypalOrderId
            ? "Completing your payment..."
            : "Redirecting to payment..."}
        </h1>
        <p className="mt-2 text-neutral-600">
          {providerParam === "paypal" || paypalOrderId
            ? "Please wait while we confirm your payment."
            : "You will be redirected to the checkout page."}
        </p>
      </section>
    );
  }

  if (canceled) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-2xl font-semibold text-primary-900">Checkout canceled</h1>
        <p className="mt-2 text-neutral-600">Your payment was not completed. You can try again.</p>
        <Button onClick={() => router.push("/pricing")} className="mt-6">
          Back to pricing
        </Button>
      </section>
    );
  }

  if (loading) return <p className="py-20 text-center text-neutral-600">Loading...</p>;
  if (!tier) return <p className="py-20 text-center text-error">Tier not found</p>;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-page max-w-2xl px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Checkout</h1>
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-4">
            <p className="text-neutral-900">{tier.label}</p>
            <p className="font-semibold text-neutral-900">${basePrice}</p>
          </div>

          {!showCoupon ? (
            <button
              type="button"
              onClick={() => setShowCoupon(true)}
              className="mt-4 cursor-pointer border-none bg-transparent p-0 text-sm text-accent-500 hover:text-accent-600"
            >
              Have a code?
            </button>
          ) : (
            <div className="mt-4">
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon code" />
                <Button variant="secondary" onClick={apply}>Apply</Button>
              </div>
              {coupon && <p className="mt-2 text-sm text-success">{coupon.discount_value}% off applied.</p>}
            </div>
          )}

          <div className="mt-6">
            <p className="text-sm font-medium text-neutral-900">Pay with</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider("stripe")}
                className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  provider === "stripe"
                    ? "border-accent-500 bg-accent-50 text-accent-700"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    provider === "stripe" ? "border-accent-500" : "border-neutral-400"
                  }`}
                >
                  {provider === "stripe" && <span className="h-2 w-2 rounded-full bg-accent-500" />}
                </span>
                Stripe
              </button>
              <button
                type="button"
                onClick={() => setProvider("paypal")}
                className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  provider === "paypal"
                    ? "border-accent-500 bg-accent-50 text-accent-700"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    provider === "paypal" ? "border-accent-500" : "border-neutral-400"
                  }`}
                >
                  {provider === "paypal" && <span className="h-2 w-2 rounded-full bg-accent-500" />}
                </span>
                PayPal
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-lg font-semibold text-neutral-900">
            <p>Total due today</p>
            <p>${total}</p>
          </div>

          {error && <p className="mt-3 text-sm text-error">{error}</p>}

          <Button variant="checkout" onClick={handleSubscribe} className="mt-6 w-full">
            Subscribe now
          </Button>

          <p className="mt-3 text-center text-xs text-neutral-600">Secure checkout via Stripe or PayPal</p>
        </Card>

        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div ref={modalRef} tabIndex={-1} className="mx-4 w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-primary-900">Confirm your subscription</h2>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Plan</span>
                  <span className="font-medium text-neutral-900">{tier.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Price</span>
                  <span className="font-medium text-neutral-900">${basePrice}</span>
                </div>
                {coupon && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Discount ({coupon.discount_value}%)</span>
                    <span className="font-medium text-success">-${basePrice - total}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-300 pt-3 text-base font-semibold">
                  <span>Total due today</span>
                  <span>${total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Payment method</span>
                  <span className="font-medium capitalize text-neutral-900">{provider}</span>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" onClick={handleCancelConfirm} className="flex-1">
                  Go back
                </Button>
                <Button variant="checkout" onClick={handleConfirm} className="flex-1">
                  Confirm & pay
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
