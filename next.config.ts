import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these server-only packages out of the bundler; they use Node APIs.
  serverExternalPackages: ["@prisma/client", "nodemailer", "bcryptjs", "qrcode"],
};

export default nextConfig;
