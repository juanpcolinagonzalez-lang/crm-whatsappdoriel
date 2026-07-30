import type { Metadata } from "next";
import "./globals.css";

const themeInitScript = `
(function () {
  try {
      var stored = localStorage.getItem("doriel-theme");
          if (stored === "dark") {
                document.documentElement.classList.add("dark");
                    }
                      } catch (e) {}
                      })();
                      `;

export const metadata: Metadata = {
  title: "CRM WhatsApp",
  description: "CRM conversacional para vender por WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="antialiased text-slate-900 bg-slate-50 dark:text-slate-100 dark:bg-slate-950">{children}</body>
    </html>
  );
}
