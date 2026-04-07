import type { Metadata } from "next";
import localFont from "next/font/local";
import { brand } from "@mwbhtx/haulvisor-core";

import { Providers } from "@/platform/web/components/providers";
import "./globals.css";

const interstate = localFont({
  src: [
    { path: "../../public/fonts/Interstate Regular/Interstate Regular.otf", weight: "400" },
    { path: "../../public/fonts/Interstate Bold/Interstate Bold.otf", weight: "700" },
  ],
  variable: "--font-interstate",
});

const gapSans = localFont({
  src: [
    { path: "../../public/fonts/GapSans-master/fonts/GapSans.ttf", weight: "400" },
    { path: "../../public/fonts/GapSans-master/fonts/GapSansBold.ttf", weight: "700" },
    { path: "../../public/fonts/GapSans-master/fonts/GapSansBlack.ttf", weight: "900" },
  ],
  variable: "--font-gap-sans",
});

const interstateMono = localFont({
  src: "../../public/fonts/Interstate Mono Regular/Interstate Mono Regular.otf",
  variable: "--font-interstate-mono",
});

const malloy = localFont({
  src: "../../public/fonts/Malloy Regular/Malloy Regular.ttf",
  variable: "--font-malloy",
});

const sohneMono = localFont({
  src: [
    { path: "../../public/fonts/SohneMono-font/SohneMono-Leicht.ttf", weight: "300" },
    { path: "../../public/fonts/SohneMono-font/SohneMono-Buch.ttf", weight: "400" },
    { path: "../../public/fonts/SohneMono-font/SohneMono-Kraftig.ttf", weight: "500" },
    { path: "../../public/fonts/SohneMono-font/SohneMono-Halbfett.ttf", weight: "600" },
    { path: "../../public/fonts/SohneMono-font/SohneMono-Fett.ttf", weight: "700" },
  ],
  variable: "--font-sohne-mono",
});

const sohne = localFont({
  src: [
    { path: "../../public/fonts/Test Söhne/test-soehne-extraleicht.woff2", weight: "200" },
    { path: "../../public/fonts/Test Söhne/test-soehne-leicht.woff2", weight: "300" },
    { path: "../../public/fonts/Test Söhne/test-soehne-buch.woff2", weight: "400" },
    { path: "../../public/fonts/Test Söhne/test-soehne-kraftig.woff2", weight: "500" },
    { path: "../../public/fonts/Test Söhne/test-soehne-halbfett.woff2", weight: "600" },
    { path: "../../public/fonts/Test Söhne/test-soehne-fett.woff2", weight: "700" },
    { path: "../../public/fonts/Test Söhne/test-soehne-dreiviertelfett.woff2", weight: "800" },
    { path: "../../public/fonts/Test Söhne/test-soehne-extrafett.woff2", weight: "900" },
  ],
  variable: "--font-archivo",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: "Haulvisor",
  description: brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interstate.variable} ${malloy.variable} ${interstateMono.variable} ${sohneMono.variable} ${sohne.variable} ${gapSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
