/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["*"],
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.remindi.online' }],
        destination: 'https://remindi.online/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
