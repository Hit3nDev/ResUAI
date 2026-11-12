import type { Metadata } from "next";
import { Archivo, Carlito } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/AuthContext";
import "../styles/globals.css";

// One variable family does everything: normal width for the interface, ultra-condensed for display type.
const ui = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-ui", display: "swap" });
// The resume itself is set in Calibri's metric twin, so the preview matches the exported Word file.
const doc = Carlito({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-doc", display: "swap" });

export const metadata: Metadata = {
  title: "ResUAI — resumes without the filler",
  description: "Write a resume, see every change the AI makes, and score it against a job ad. Export clean Word and PDF files.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${doc.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#0A0A0F", color: "#fff", borderRadius: "4px", borderLeft: "4px solid #2340F5",
                fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-ui), system-ui, sans-serif", padding: "11px 14px",
              },
              success: { iconTheme: { primary: "#FFE94A", secondary: "#0A0A0F" } },
              error:   { iconTheme: { primary: "#FF6B63", secondary: "#0A0A0F" } },
              loading: { iconTheme: { primary: "#ffffff", secondary: "#0A0A0F" } },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
