import type { NextConfig } from "next";

const produccion = process.env.NODE_ENV === "production";

/** Origen de Supabase por http(s) y por websocket (Realtime), para connect-src. */
function origenesSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { protocol, host } = new URL(url);
    return [`${protocol}//${host}`, `${protocol === "https:" ? "wss:" : "ws:"}//${host}`];
  } catch {
    return [];
  }
}

const csp = [
  "default-src 'self'",
  // Next inyecta scripts en línea para hidratar; en desarrollo el recargado en caliente usa eval.
  `script-src 'self' 'unsafe-inline'${produccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  ["connect-src 'self'", ...origenesSupabase()].join(" "),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara se usa para "Escanear chapeta".
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(), payment=()" },
  ...(produccion ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // exceljs se carga tal cual en el servidor (importador de planillas)
  serverExternalPackages: ["exceljs"],
  experimental: {
    // El libro de planillas quincenales pesa ~1 MB; se deja margen para archivos más grandes.
    serverActions: { bodySizeLimit: "15mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: cabecerasSeguridad },
      { source: "/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
