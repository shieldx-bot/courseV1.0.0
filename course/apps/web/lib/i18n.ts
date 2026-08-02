const translations: Record<string, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.courses": "Courses",
    "nav.pricing": "Pricing",
    "nav.about": "About",
    "nav.blog": "Blog",
    "nav.membership": "Membership",
    "nav.reviews": "Reviews",
    "nav.login": "Log in",
    "nav.signup": "Sign up",
    "nav.account": "Account",
    "nav.learn": "Learn",
    "nav.admin": "Admin",
    "nav.logout": "Log out",
    "nav.theme": "Toggle theme",
    "nav.menu": "Toggle menu",
    "footer.rights": "All rights reserved.",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.tryAgain": "Try again",
    "common.search": "Search",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.submit": "Submit",
    "common.confirm": "Confirm",
    "common.back": "Back",
  },
};

export type Locale = keyof typeof translations;

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("ascendly_locale") as Locale | null;
    if (stored && translations[stored]) return stored;
  }
  return currentLocale;
}

export function t(key: string, locale?: Locale): string {
  const loc = locale || getLocale();
  return translations[loc]?.[key] || key;
}

export function useLocale() {
  const setLanguage = (locale: Locale) => {
    currentLocale = locale;
    if (typeof window !== "undefined") {
      localStorage.setItem("ascendly_locale", locale);
    }
  };
  return { locale: getLocale(), setLocale: setLanguage, t };
}
