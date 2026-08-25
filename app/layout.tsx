 import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export const viewport: Viewport = {
  themeColor: "#091726",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "DDS ON - Diálogo Diário de Segurança Online",
  description: "Plataforma Digital de Lista de Presença com Biometria Facial, Assinatura Digital e Validade Jurídica.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    shortcut: "/icon-192x192.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
  },
  openGraph: {
    title: "DDS ON - Diálogo Diário de Segurança Online",
    description: "Elimine o papel. Lista de presença com biometria facial, assinatura digital e atas em PDF instantâneas.",
    siteName: "DDS ON",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
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
    images: ["/icon-512x512.png"],
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
        {/* Metatags PWA Nativas para Android e iOS */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DDS ON" />
        
        {/* Ícones Diretos */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="shortcut icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Registro do Service Worker com escopo relativo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('PWA ServiceWorker registrado com sucesso:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('Falha no SW:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
        {/* Botão de Instalação Automática */}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}