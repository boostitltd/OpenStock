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

// Neither Latin font has the shekel sign, so prices showed an empty box. This face is Rubik's Hebrew subset
// limited to ₪ by unicode-range: it sits first in every font stack and draws that one character, nothing else.
const shekel = localFont({
  src: "./fonts/rubik-hebrew.woff2",
  variable: "--font-hebrew",
  weight: "300 900",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+20AA" }],
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
  description: "OpenStock is an open-source alternative to expensive market platforms. Track real-time prices, set personalized alerts, and explore detailed company insights — built openly, for everyone, forever free.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body
                className={`${shekel.variable} ${jakarta.variable} ${plexMono.variable} font-sans antialiased`}
            >
                {children}
                <Toaster/>
                <OntoLaunchCard />
                <Analytics />
            </body>
        </html>
    );
}
