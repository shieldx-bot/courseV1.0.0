/** @type {import('next').NextConfig} */
// import withSerwist from '@serwist/next';

const nextConfig = {
  reactStrictMode: true,
  // output: "standalone", // Commented out for development
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_BASE_URL || "http://127.0.0.1:8000"}/:path*`,
      },
    ];
  },
};

// Temporarily disabled Serwist for development
// export default withSerwist({
//   swSrc: 'app/sw.ts',
//   swDest: 'public/sw.js',
//   reloadOnOnline: true,
// })(nextConfig);

export default nextConfig;
