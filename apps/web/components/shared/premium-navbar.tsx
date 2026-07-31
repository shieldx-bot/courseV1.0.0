"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Moon, Sun, ChevronDown, BookOpen, LayoutDashboard, Trophy, CreditCard, Star, Info, HelpCircle, User, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/components/theme-provider";

// Navigation links configuration
const navLinks = [
  { href: "/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" />, hasMegaMenu: true },
  { href: "/learning-paths", label: "Learning Paths", icon: <LayoutDashboard className="h-4 w-4" />, hasMegaMenu: true },
  { href: "/arena", label: "Arena", icon: <Trophy className="h-4 w-4" /> },
  { href: "/membership", label: "Membership", icon: <User className="h-4 w-4" />, hasMegaMenu: true },
  { href: "/pricing", label: "Pricing", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/reviews", label: "Reviews", icon: <Star className="h-4 w-4" /> },
  { href: "/about", label: "About", icon: <Info className="h-4 w-4" /> },
  { href: "/faq", label: "FAQ", icon: <HelpCircle className="h-4 w-4" /> },
];

// Mega menu content for Courses
const coursesMegaMenu = {
  title: "Explore Our Courses",
  description: "Comprehensive courses designed to take you from beginner to expert",
  sections: [
    {
      title: "Development",
      items: [
        { href: "/courses/web-development", label: "Web Development", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/mobile-development", label: "Mobile Development", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/backend-development", label: "Backend Development", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/devops", label: "DevOps & Cloud", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
      ]
    },
    {
      title: "Design",
      items: [
        { href: "/courses/ui-ux", label: "UI/UX Design", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/graphic-design", label: "Graphic Design", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/product-design", label: "Product Design", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
      ]
    },
    {
      title: "Business",
      items: [
        { href: "/courses/marketing", label: "Digital Marketing", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/entrepreneurship", label: "Entrepreneurship", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
        { href: "/courses/product-management", label: "Product Management", icon: <BookOpen className="h-4 w-4 text-accent-500" /> },
      ]
    }
  ],
  featured: {
    title: "Featured Course",
    course: "Advanced React Patterns",
    description: "Master advanced React patterns and build production-ready applications",
    cta: "/courses/advanced-react",
    image: "/images/courses/react-advanced.jpg"
  }
};

// Mega menu content for Learning Paths
const learningPathsMegaMenu = {
  title: "Structured Learning Paths",
  description: "Career-focused paths to help you achieve your goals",
  sections: [
    {
      title: "Career Tracks",
      items: [
        { href: "/learning-paths/fullstack", label: "Full Stack Developer", duration: "6 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
        { href: "/learning-paths/frontend", label: "Frontend Specialist", duration: "4 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
        { href: "/learning-paths/backend", label: "Backend Engineer", duration: "5 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
      ]
    },
    {
      title: "Skill Development",
      items: [
        { href: "/learning-paths/ui-design", label: "UI Design Mastery", duration: "3 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
        { href: "/learning-paths/devops", label: "DevOps Certification", duration: "4 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
        { href: "/learning-paths/data-science", label: "Data Science Fundamentals", duration: "5 months", icon: <LayoutDashboard className="h-4 w-4 text-accent-500" /> },
      ]
    }
  ],
  cta: {
    title: "Explore All Paths",
    href: "/learning-paths",
    description: "Find the perfect path for your career goals"
  }
};

// Mega menu content for Membership
const membershipMegaMenu = {
  title: "Membership Benefits",
  description: "Unlock premium features and exclusive content",
  tiers: [
    {
      title: "Basic",
      price: "Free",
      features: ["Access to free courses", "Community support", "Basic certifications"],
      cta: "/membership/basic"
    },
    {
      title: "Pro",
      price: "$29/month",
      features: ["All courses unlocked", "Priority support", "Advanced certifications", "Exclusive content"],
      highlighted: true,
      cta: "/membership/pro"
    },
    {
      title: "Enterprise",
      price: "Custom",
      features: ["Team licensing", "Dedicated account manager", "Custom learning paths", "API access"],
      cta: "/membership/enterprise"
    }
  ],
  testimonial: {
    quote: "The Pro membership transformed my career. The exclusive content and priority support were game-changers.",
    author: "Sarah Johnson, Senior Developer",
    avatar: "/images/testimonials/sarah.jpg"
  }
};

export function PremiumNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navbarRef = useRef<HTMLElement>(null);

  // Close mobile menu
  const close = useCallback(() => {
    setOpen(false);
    setActiveMegaMenu(null);
  }, []);

  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu on path change
  useEffect(() => { close(); }, [pathname, close]);

  // Close menu on scroll when open
  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [open, close]);

  // Keyboard navigation for mobile menu
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

  // Handle mega menu hover with delay
  const handleMegaMenuHover = (menuName: string | null, delay: number = 100) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    if (menuName) {
      const timeout = setTimeout(() => {
        setActiveMegaMenu(menuName);
      }, delay);
      setHoverTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setActiveMegaMenu(null);
      }, 200);
      setHoverTimeout(timeout);
    }
  };


  return (
    <>
      <header
        ref={navbarRef}
        className={`sticky top-0 z-50 transition-all duration-300 ease-out ${
          scrolled
            ? "bg-white/80 dark:bg-primary-900/80 backdrop-blur-md shadow-sm border-b border-white/10 dark:border-primary-700/20"
            : "bg-white dark:bg-primary-900 border-b border-transparent"
        }`}
      >
        <nav className="mx-auto flex max-w-[1280px] h-[76px] items-center justify-between px-8">
          {/* Logo - Left */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold tracking-tight text-primary-700 dark:text-white">
              Ascendly
            </Link>
          </div>

          {/* Desktop Navigation - Center */}
          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.href} className="relative group">
                <Link
                  href={link.href}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white transition-colors duration-300 ease-out ${
                    pathname === link.href ? 'text-primary-700 dark:text-white font-semibold' : ''
                  }`}
                  onMouseEnter={() => link.hasMegaMenu && handleMegaMenuHover(link.label)}
                  onMouseLeave={() => link.hasMegaMenu && handleMegaMenuHover(null)}
                  aria-haspopup={link.hasMegaMenu ? "true" : undefined}
                  aria-expanded={activeMegaMenu === link.label ? "true" : undefined}
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {link.hasMegaMenu && <ChevronDown className="h-3 w-3 opacity-60" />}
                </Link>

                {/* Mega Menu */}
                {link.hasMegaMenu && activeMegaMenu === link.label && (
                  <div
                    className="absolute left-0 mt-2 w-full animate-premium-fade-in"
                    onMouseEnter={() => handleMegaMenuHover(link.label, 0)}
                    onMouseLeave={() => handleMegaMenuHover(null, 0)}
                  >
                    <div className="rounded-xl border border-white/10 dark:border-primary-700/20 bg-white dark:bg-primary-800 shadow-xl p-6">
                      {link.label === "Courses" && (
                        <CoursesMegaMenu content={coursesMegaMenu} />
                      )}
                      {link.label === "Learning Paths" && (
                        <LearningPathsMegaMenu content={learningPathsMegaMenu} />
                      )}
                      {link.label === "Membership" && (
                        <MembershipMegaMenu content={membershipMegaMenu} />
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Right side - Theme toggle, Auth, CTA */}
          <div className="hidden items-center gap-4 md:flex">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-primary-700 transition-all duration-300 ease-out focus-ring"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-white transition-transform duration-300 ease-out hover:rotate-12" />
              ) : (
                <Moon className="h-5 w-5 text-neutral-600 transition-transform duration-300 ease-out hover:rotate-12" />
              )}
            </button>

            {/* Auth buttons */}
            {user ? (
              <>
                <Link href="/account">
                  <Button variant="ghost" className="text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-primary-700">
                    Account
                  </Button>
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" className="text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-primary-700">
                      Admin
                    </Button>
                  </Link>
                )}
                <Button variant="danger" onClick={logout} className="hover:shadow-lg hover:shadow-error/20">
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-primary-700">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log in
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button
                    variant="checkout"
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98] transition-all duration-300 ease-out hover-lift rounded-xl px-6 py-3 text-sm font-semibold"
                  >
                    Start Learning
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            ref={toggleRef}
            className="md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
          </button>
        </nav>

        {/* Mobile menu overlay */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300 ease-in-out opacity-100"
            onClick={close}
            aria-hidden="true"
          />
        )}

        {/* Mobile menu */}
        <div
          ref={menuRef}
          role="dialog"
          aria-modal={open}
          aria-label="Navigation menu"
          className={`grid md:hidden transition-[grid-template-rows] duration-300 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden min-h-0 border-t border-white/10 dark:border-primary-700/20 px-6 pb-4 bg-white dark:bg-primary-900">
            <ul className="flex flex-col gap-4 pt-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white transition-colors duration-200 ease-out"
                    onClick={close}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
              <li className="mt-4 pt-4 border-t border-white/10 dark:border-primary-700/20">
                <button onClick={toggle} className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white transition-colors duration-200 ease-out">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
              </li>
              {user ? (
                <>
                  <li><Link href="/account" className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white" onClick={close}>Account</Link></li>
                  {user.role === "admin" && <li><Link href="/admin" className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white" onClick={close}>Admin</Link></li>}
                  <li><button onClick={logout} className="text-error hover:text-error/80 transition-colors duration-200 ease-out">Log out</button></li>
                </>
              ) : (
                <>
                  <li><Link href="/login" className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:text-primary-700 dark:hover:text-white" onClick={close}><LogIn className="h-4 w-4" /> Log in</Link></li>
                  <li><Link href="/pricing" className="text-accent-500 hover:text-accent-600 font-semibold transition-colors duration-200 ease-out" onClick={close}>Start learning</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>
      </header>
    </>
  );
}

// Mega Menu Components
function CoursesMegaMenu({ content }: { content: typeof coursesMegaMenu }) {
  return (
    <div className="grid grid-cols-3 gap-8">
      <div className="col-span-2">
        <h3 className="text-lg font-semibold text-primary-700 dark:text-white mb-2">{content.title}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{content.description}</p>

        <div className="grid grid-cols-3 gap-6">
          {content.sections.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold text-neutral-600 dark:text-neutral-300 mb-3">{section.title}</h4>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-700 dark:hover:text-white transition-colors duration-200 ease-out group"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 group-hover:text-primary-700 dark:group-hover:text-white transition-colors duration-200 ease-out">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-l border-white/10 dark:border-primary-700/20 pl-6">
        <h4 className="font-semibold text-neutral-600 dark:text-neutral-300 mb-3">{content.featured.title}</h4>
        <div className="bg-neutral-50 dark:bg-primary-700 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent-100 dark:bg-accent-500/20 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-accent-500 dark:text-accent-100" />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold text-neutral-700 dark:text-white">{content.featured.course}</h5>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{content.featured.description}</p>
            </div>
          </div>
        </div>
        <Link
          href={content.featured.cta}
          className="inline-block w-full text-center bg-accent-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-accent-600 transition-colors duration-200 ease-out"
        >
          View Course
        </Link>
      </div>
    </div>
  );
}

function LearningPathsMegaMenu({ content }: { content: typeof learningPathsMegaMenu }) {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold text-primary-700 dark:text-white mb-2">{content.title}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{content.description}</p>

        <div className="grid grid-cols-2 gap-4">
          {content.sections.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold text-neutral-600 dark:text-neutral-300 mb-3">{section.title}</h4>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-700 dark:hover:text-white transition-colors duration-200 ease-out group"
                    >
                      {item.icon}
                      <div className="flex-1">
                        <span>{item.label}</span>
                        <span className="block text-xs text-neutral-400 dark:text-neutral-500">{item.duration}</span>
                      </div>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 group-hover:text-primary-700 dark:group-hover:text-white transition-colors duration-200 ease-out">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-neutral-50 dark:bg-primary-700 rounded-lg p-6">
        <h4 className="font-semibold text-neutral-600 dark:text-neutral-300 mb-3">{content.cta.title}</h4>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{content.cta.description}</p>
        <Link
          href={content.cta.href}
          className="inline-block bg-accent-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-accent-600 transition-colors duration-200 ease-out"
        >
          Explore All Paths
        </Link>
      </div>
    </div>
  );
}

function MembershipMegaMenu({ content }: { content: typeof membershipMegaMenu }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <h3 className="text-lg font-semibold text-primary-700 dark:text-white mb-2">{content.title}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{content.description}</p>

        <div className="grid grid-cols-3 gap-4">
          {content.tiers.map((tier, index) => (
            <div
              key={index}
              className={`border border-white/10 dark:border-primary-700/20 rounded-lg p-4 ${
                tier.highlighted ? 'border-accent-500 dark:border-accent-400 bg-accent-50 dark:bg-accent-500/10' : ''
              }`}
            >
              <h4 className="font-semibold text-neutral-600 dark:text-neutral-300 mb-2">{tier.title}</h4>
              <div className="text-2xl font-bold text-primary-700 dark:text-white mb-2">{tier.price}</div>
              <ul className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2">
                    <span className="text-accent-500 mt-1">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={tier.cta}
                className={`inline-block w-full text-center text-sm font-semibold py-2 px-3 rounded-lg transition-colors duration-200 ease-out ${
                  tier.highlighted
                    ? 'bg-accent-500 text-white hover:bg-accent-600'
                    : 'bg-neutral-100 dark:bg-primary-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-primary-600'
                }`}
              >
                Learn More
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="border-l border-white/10 dark:border-primary-700/20 pl-4">
        <div className="bg-neutral-50 dark:bg-primary-700 rounded-lg p-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 italic mb-3">"{content.testimonial.quote}"</p>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-accent-500 dark:text-accent-100" />
            </div>
            <div className="text-xs">
              <div className="font-semibold text-neutral-600 dark:text-neutral-300">{content.testimonial.author}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}