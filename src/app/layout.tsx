import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estimate Takeoff",
  description: "PDF Area Measurement for Plans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--color-surface)] text-[var(--color-foreground)]">
        {children}
      </body>
    </html>
  );
}
