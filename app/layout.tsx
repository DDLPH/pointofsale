import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ก๋วยเตี๋ยวไก่มะระ · POS",
  description: "ขายหน้าร้าน บันทึกบิล และสรุปยอดขายบนมือถือ",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
