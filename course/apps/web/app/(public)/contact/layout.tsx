import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Contact Ascendly — Membership & Course Support",
  description:
    "Questions about Ascendly? Send us a message and our team will reply within one business day.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
