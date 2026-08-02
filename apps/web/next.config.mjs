const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? (await import("@next/bundle-analyzer")).default({ enabled: true })
  : (config) => config;

const withSerwist = (await import("@serwist/next")).default({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

/** @type {import('next').NextConfig} */
const nextConfig = withSerwist(
  withBundleAnalyzer({
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  })
);

export default nextConfig;