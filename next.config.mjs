/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/pitch-deck', destination: '/pitch-deck.html' },
    ];
  },
};

export default nextConfig;
