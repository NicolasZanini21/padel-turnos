import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["700", "800"] });

export const metadata: Metadata = {
  title: { default: "Global Padel Center · Reservá tu cancha", template: "%s · Global Padel Center" },
  description: "Reservá tu cancha de pádel en Global Padel Center, Rosario. Elegí día y horario y coordiná el pago por WhatsApp.",
  // Para que la imagen al compartir el link tenga una URL absoluta. En Vercel, si no está
  // NEXT_PUBLIC_SITE_URL, usa el dominio de producción que Vercel informa solo.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  ),
  openGraph: { siteName: "Global Padel Center", locale: "es_AR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0C1014",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-fondo font-sans text-texto">{children}</body>
    </html>
  );
}
