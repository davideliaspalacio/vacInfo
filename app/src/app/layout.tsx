import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "VacInfo — Gestión lechera", template: "%s · VacInfo" },
  description: "Administra la producción, la reproducción y los costos de tus fincas lecheras.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VacDaTa", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#173f2a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
