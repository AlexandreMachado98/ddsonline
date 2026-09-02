import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import OfflineBanner from "@/components/OfflineBanner";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ddsonline-phi.vercel.app"),
  title: "DDS ON • Diálogo Diário de Segurança & Auditoria Digital",
  description: "Plataforma oficial de Diálogo Diário de Segurança (DDS ON) com Biometria Facial, Assinatura Digital, Modo Presencial e Transmissão em Conformidade com as NRs.",
  applicationName: "DDS ON",
  authors: [{ name: "AM TST", url: "https://amtst.vercel.app" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "DDS ON • Diálogo Diário de Segurança",
    description: "Acesse o DDS de hoje, valide sua presença com biometria facial e assinatura digital ou gerencie relatórios de conformidade.",
    url: "https://ddsonline-phi.vercel.app",
    siteName: "DDS ON",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "DDS ON - Plataforma de Segurança do Trabalho e Auditoria Digital",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DDS ON • Diálogo Diário de Segurança",
    description: "Plataforma oficial de Diálogo Diário de Segurança com Biometria Facial, Assinatura Digital e Conformidade com as NRs.",
    images: ["/icon.svg"],
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
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-emerald-600 selection:text-white`}>
        <ToastProvider>
          <OfflineBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}