import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Scooby Says — Dog Bark Translator",
  description:
    "Translate your Beagle's barks into fun English phrases using AI. Powered by real-time audio analysis and LLM intelligence.",
  keywords: ["dog bark translator", "beagle", "pet app", "AI translator", "Scooby"],
  authors: [{ name: "BarkTranslator Team" }],
  openGraph: {
    title: "Scooby Says — Dog Bark Translator",
    description: "Translate your Beagle's barks into fun English phrases using AI.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#171310",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
