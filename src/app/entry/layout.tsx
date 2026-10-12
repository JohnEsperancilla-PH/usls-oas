import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/entry.webmanifest",
};

export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
