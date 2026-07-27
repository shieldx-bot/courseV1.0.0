import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ascendly.io";

interface MetaOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  ogType?: string;
  locale?: string;
  noindex?: boolean;
}

export function makeMetadata({
  title = "Ascendly — One Membership, 2,000+ Online Courses",
  description = "Learn business, tech, design, and data skills with one membership. 2,000+ expert-led courses. Start your free preview today.",
  path = "/",
  image = `${SITE_URL}/og-image.png`,
  ogType = "website",
  locale = "en_US",
  noindex = false,
}: MetaOptions = {}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: title,
      description,
      url,
      siteName: "Ascendly",
      locale,
      type: ogType as "website" | "article",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: "@ascendly",
    },
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ascendly-api.anhnv-24810310060.workers.dev";

export { SITE_URL, API_BASE };
