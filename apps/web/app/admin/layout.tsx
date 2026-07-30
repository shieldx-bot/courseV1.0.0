import Link from "next/link";
import { AdminGuard } from "@/components/auth-guard";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/ai-analytics", label: "AI Analytics" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/contacts", label: "Messages" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/adaptive-mastery", label: "Adaptive Mastery" },
  { href: "/admin/enterprise", label: "Enterprise" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="mx-auto flex max-w-page px-6 py-8">
        <aside className="hidden w-48 shrink-0 pr-6 md:block" aria-label="Admin navigation">
          <nav className="space-y-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AdminGuard>
  );
}
