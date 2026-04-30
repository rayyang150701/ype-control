/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as standalone for Vercel deployment
  output: undefined, // Vercel handles this automatically
  
  // Suppress hydration warnings for browser extensions
  reactStrictMode: true,
  
  // Optimize images
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
