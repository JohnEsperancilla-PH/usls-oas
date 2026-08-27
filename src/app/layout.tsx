import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const gotham = localFont({
  src: [
    { path: "../../public/fonts/Gotham-Book.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Gotham-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Gotham-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-gotham",
  display: "swap",
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
      className={`${gotham.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
