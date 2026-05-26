/** @type {import('next').NextConfig} */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['localhost:3000'];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins }
  }
};

module.exports = nextConfig;
