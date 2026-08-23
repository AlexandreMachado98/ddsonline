 import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  // Substitua pela URL real do seu sistema na Vercel (ou domínio próprio)
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://seu-projeto.vercel.app'),
  title: "DDS ON - Diálogo Diário de Segurança Online",
  description: "Plataforma Digital de Lista de Presença com Biometria Facial, Assinatura Digital e Validade Jurídica.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
  },
  // Configuração do Card de Compartilhamento (WhatsApp, Facebook, LinkedIn, etc.)
  openGraph: {
    title: "DDS ON - Diálogo Diário de Segurança Online",
    description: "Elimine o papel. Lista de presença com biometria facial, assinatura digital e atas em PDF instantâneas.",
    url: "https://seu-projeto.vercel.app",
    siteName: "DDS ON",
    images: [
      {
        url: "/opengraph-image.png", // ou /og-image.png se estiver na pasta public
        width: 1200,
        height: 630,
        alt: "DDS ON - Plataforma Digital de SST",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DDS ON - Diálogo Diário de Segurança Online",
    description: "Plataforma Digital de Lista de Presença com Biometria Facial e Assinatura Digital.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}