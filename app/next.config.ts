import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs se carga tal cual en el servidor (importador de planillas)
  serverExternalPackages: ["exceljs"],
  experimental: {
    // El libro de planillas quincenales pesa ~1 MB; se deja margen para archivos más grandes.
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
