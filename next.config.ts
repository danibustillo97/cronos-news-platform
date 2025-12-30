import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "a1.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "a2.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "a3.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "a4.espncdn.com",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "cdn.espn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.marca.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "estaticos.marca.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "estaticos.sport.es",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "as01.epimg.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.tycsports.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.goal.com",
        pathname: "/**",
      },
       {
        protocol: 'https',
        hostname: 'www.foxsports.com.mx',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
