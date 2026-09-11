import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/context/AuthContext";
import OfflineBanner from "@/components/OfflineBanner";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ddsonline-phi.vercel.app"),
  title: "DDS ON • Diálogo Diário de Segurança & Gestão Digital de SST",
  description: "Plataforma de Diálogo Diário de Segurança (DDS ON) com Registro Fotográfico, Assinatura Eletrônica, Modo Presencial e Gestão de Evidências em SST.",
  applicationName: "DDS ON",
  authors: [{ name: "DDS Master", url: "https://ddsonline-phi.vercel.app" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "DDS ON • Diálogo Diário de Segurança",
    description: "Acesse o DDS do dia, registre sua presença com foto facial e assinatura eletrônica ou gerencie relatórios de comprovação em SST.",
    url: "https://ddsonline-phi.vercel.app",
    siteName: "DDS ON",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "DDS ON - Plataforma de Segurança do Trabalho e Gestão de DDS",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DDS ON • Diálogo Diário de Segurança",
    description: "Plataforma de Diálogo Diário de Segurança com Registro Fotográfico, Assinatura Eletrônica e Gestão de Evidências.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-emerald-600 selection:text-white`}>
        <AuthProvider>
          <ToastProvider>
            <OfflineBanner />
            <PwaInstallPrompt />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}