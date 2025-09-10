/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@raymed/shared'],
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3100',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  async rewrites() {
    return [
      {
        source: '/api/server/:path*',
        destination: `${process.env.SERVER_URL || 'http://localhost:3333'}/api/:path*`,
      },
    ];
  },
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
