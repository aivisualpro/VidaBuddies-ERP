const nextConfig = {
  // This single line hides the indicator
  devIndicators: false,
  serverActions: {
    bodySizeLimit: "50mb",
  },
  serverExternalPackages: ["html-pdf-node", "mailparser", "imap-simple"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
