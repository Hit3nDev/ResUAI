/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In development: proxy to local backend
    // In production:  set NEXT_PUBLIC_API_URL (the rewrite won't be used — calls go direct)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` }
    ];
  },
};
module.exports = nextConfig;
