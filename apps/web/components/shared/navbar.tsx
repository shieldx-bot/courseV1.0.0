"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/components/theme-provider";
import { isOnboardingSkipped } from "@/lib/onboarding-data";
import { NotificationBell } from "@/components/ecosystem/notification-bell";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/learning-paths", label: "Paths" },
  { href: "/challenges", label: "Challenges" },
  { href: "/skills", label: "Skills" },
  { href: "/arena", label: "Arena" },
  { href: "/events", label: "Events" },
  { href: "/creator", label: "Creator" },
  { href: "/activity", label: "Activity" },
  { href: "/membership", label: "Membership" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Detect scroll for navbar elevation
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => { close(); }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const focusable = menu.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); toggleRef.current?.focus(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    menu.addEventListener("keydown", onKeyDown);
    first?.focus();
    return () => menu.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ease-out ${
        scrolled 
          ? "bg-primary-900/95 backdrop-blur-md shadow-lg elevation-2" 
          : "bg-primary-700"
      }`}
    >
      <nav className="mx-auto flex max-w-page items-center justify-between px-6 py-4">
        <Link 
          href="/" 
          className="text-xl font-bold tracking-tight text-white hover:text-neutral-100 transition-colors"
        >
          Ascendly
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link 
                href={l.href} 
                className={`text-sm font-medium transition-colors ${
                  pathname === l.href 
                    ? "text-white" 
                    : "text-neutral-200 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={toggle}
            className="rounded-lg p-2 text-neutral-200 hover:bg-white/10 hover:text-white transition-all duration-200"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {user ? (
            <>
              <NotificationBell />
              {isOnboardingSkipped(user.onboarding) && (
                <Link href="/onboarding">
                  <Button
                    variant="outline"
                    className="border-amber-400/50 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:text-amber-200"
                  >
                    Finish setup
                  </Button>
                </Link>
              )}
              <Link href="/account">
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                  Account
                </Button>
              </Link>
              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="danger" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                  Log in
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="checkout">
                  Start learning
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          ref={toggleRef}
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </nav>

       {open && (
         <div
           className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300 ease-in-out opacity-100"
           onClick={close}
           aria-hidden="true"
         />
       )}

      <div
        ref={menuRef}
        role="dialog"
        aria-modal={open}
        aria-label="Navigation menu"
        className={`grid md:hidden transition-[grid-template-rows] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0 border-t border-white/10 px-6 pb-4 bg-primary-800">
          <ul className="flex flex-col gap-4 pt-4">
            {links.map((l) => (
              <li key={l.href}>
                <Link 
                  href={l.href}
                  className={`block py-2 ${
                    pathname === l.href 
                      ? "text-white font-semibold" 
                      : "text-neutral-200"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button 
                onClick={toggle} 
                className="flex items-center gap-2 text-neutral-200 py-2"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </li>
            {user ? (
              <>
                <li><Link href="/account" className="block py-2 text-neutral-200">Account</Link></li>
                {user.role === "admin" && <li><Link href="/admin" className="block py-2 text-neutral-200">Admin</Link></li>}
                <li><button onClick={logout} className="block py-2 text-neutral-200">Log out</button></li>
              </>
            ) : (
              <>
                <li><Link href="/login" className="block py-2 text-neutral-200">Log in</Link></li>
                <li><Link href="/pricing" className="block py-2 text-accent-500 font-semibold">Start learning</Link></li>
              </>
            )}
          </ul>
        </div>
      </div>
    </header>
  );
}
