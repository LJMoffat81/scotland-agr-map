import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scotland AGR Map",
  description:
    "Interactive Annual Ground Rent map for Scotland — one What3Words square at a time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}