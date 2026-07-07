import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM WhatsApp",
  description: "CRM conversacional para vender por WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased text-slate-900 bg-slate-50">{children}</body>
    </html>
  );
}
