import Link from "next/link";

const productLinks = [
  { href: "/courses", label: "Courses" },
  { href: "/learning-paths", label: "Learning Paths" },
  { href: "/membership", label: "Membership" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

const supportLinks = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const socialLinks = [
  { href: "https://twitter.com", label: "Twitter" },
  { href: "https://linkedin.com", label: "LinkedIn" },
  { href: "https://youtube.com", label: "YouTube" },
];

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300" role="contentinfo">
      <div className="mx-auto max-w-page px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold text-white">Ascendly</p>
            <p className="mt-2 max-w-xs text-sm">
              One membership. Every skill you&apos;ll ever need.
            </p>
          </div>
          <nav aria-label="Product links">
            <p className="font-medium text-white">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Support links">
            <p className="font-medium text-white">Support</p>
            <ul className="mt-3 space-y-2 text-sm">
              {supportLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Social media links">
            <p className="font-medium text-white">Follow</p>
            <ul className="mt-3 space-y-2 text-sm">
              {socialLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="hover:text-white" aria-label={`Follow us on ${l.label}`}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-12 border-t border-neutral-700 pt-6 text-xs text-neutral-600">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> Ascendly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
