import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/AuthContext";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "ResUAI — Build Resumes That Get You Hired",
  description: "AI-powered resume creation, enhancement, and ATS scoring. Generate professional DOCX & PDF resumes in seconds — free, no sign-up required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#080F1C",
                color: "#E8EEF8",
                border: "1px solid #162034",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                borderRadius: "10px",
              },
              success: { iconTheme: { primary: "#00C896", secondary: "#040B14" } },
              error:   { iconTheme: { primary: "#F87171", secondary: "#040B14" } },
              loading: { iconTheme: { primary: "#0EA5E9", secondary: "#040B14" } },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
