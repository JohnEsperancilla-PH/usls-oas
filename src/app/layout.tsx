import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "USLS Online Appointment System",
    template: "%s | USLS OAS",
  },
  description: "Schedule your campus appointments online at University of St. La Salle. Quick, easy, and secure — no account required.",
  keywords: ["USLS", "University of St. La Salle", "appointment", "campus", "visitor", "booking"],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#006633",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
