import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import {Toaster} from "@/components/ui/sonner";
import OntoLaunchCard from "@/components/OntoLaunchCard";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Hebrew letters and the shekel sign come from Rubik's Hebrew subset; its unicode-range leaves every Latin
// letter and digit to Jakarta / Plex, so numbers keep the same shapes everywhere.
const hebrew = localFont({
  src: "./fonts/rubik-hebrew.woff2",
  variable: "--font-hebrew",
  weight: "300 900",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F" }],
  adjustFontFallback: false,
  fallback: [],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "OpenStock",
  description: "מניות בתל אביב ובוול סטריט, התיק שלך, תחזיות ומה לקנות.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="he" dir="rtl" className="dark">
            <body
                className={`${hebrew.variable} ${jakarta.variable} ${plexMono.variable} font-sans antialiased`}
            >
                {children}
                <Toaster dir="rtl" position="bottom-left" />
                <OntoLaunchCard />
                {/* Vercel's analytics script only exists on Vercel; elsewhere (Cloud Run) it is a 404 and a console error */}
                {process.env.VERCEL ? <Analytics /> : null}
            </body>
        </html>
    );
}
