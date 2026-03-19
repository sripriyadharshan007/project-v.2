/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@chakra-ui/react', '@chakra-ui/next-js'],
  experimental: {
    optimizePackageImports: ['@chakra-ui/react', 'lucide-react'],
  },
};

export default nextConfig;
