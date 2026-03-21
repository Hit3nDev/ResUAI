"use client";
import { useRouter, usePathname } from "next/navigation";
import { Lock, ArrowRight, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";
import Link from "next/link";

interface Props {
  attemptId: number | null;
  onDownload: (format: "docx" | "pdf" | "txt") => void;
  label?: string;
}

/**
 * Wraps download buttons. If the user is not logged in, shows a modal
 * prompting them to sign in / sign up rather than immediately downloading.
 */
export default function DownloadGate({ attemptId, onDownload, label = "Download Resume" }: Props) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [modal, setModal] = useState(false);

  function handleClick() {
    if (!user) { setModal(true); return; }
    // Default to DOCX if user just clicks the main button
    if (attemptId) onDownload("docx");
  }

  const redirectUrl = encodeURIComponent(pathname);

  return (
    <>
      {/* Main download button */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {(["docx", "pdf"] as const).map(fmt => (
          <button
            key={fmt}
            onClick={() => {
              if (!user) { setModal(true); return; }
              if (attemptId) onDownload(fmt);
            }}
            className="btn-primary"
            disabled={!attemptId}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: fmt === "pdf" ? "linear-gradient(135deg, #0EA5E9, #0284C7)" : undefined,
            }}
          >
            {!user && <Lock size={13} />}
            {fmt === "docx" ? "Word (.docx)" : "PDF (.pdf)"}
          </button>
        ))}
      </div>
      <button
        onClick={() => { if (!user) { setModal(true); return; } if (attemptId) onDownload("txt"); }}
        className="btn-ghost"
        disabled={!attemptId}
        style={{ width: "100%", padding: "9px", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
      >
        {!user && <Lock size={12} />} Plain Text (.txt)
      </button>

      {/* Login required notice */}
      {!user && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, fontSize: 12, color: "#FCD34D", display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={11} /> Sign in required to download
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(4,11,20,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{
            background: "#080F1C",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            padding: "36px 32px",
            width: "100%", maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,150,0.06) inset",
            position: "relative",
          }}>
            {/* Close */}
            <button onClick={() => setModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <X size={18} color="#3D5270" />
            </button>

            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Lock size={22} color="#F59E0B" />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E8EEF8", letterSpacing: "-0.02em", marginBottom: 10 }}>
              Sign in to download
            </h2>
            <p style={{ fontSize: 14, color: "#7A8BA8", lineHeight: 1.65, marginBottom: 28 }}>
              Create a free account to download your resume as DOCX or PDF, and access it anytime from your dashboard.
            </p>

            {/* Perks */}
            <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Download as DOCX & PDF", "Save resumes to your account", "Access history anytime", "100% free, no credit card"].map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#7A8BA8" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", flexShrink: 0 }} />
                  {p}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href={`/signup?redirect=${redirectUrl}`} onClick={() => setModal(false)}>
                <button className="btn-primary" style={{ width: "100%", padding: "13px", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  Create Free Account <ArrowRight size={14} />
                </button>
              </Link>
              <Link href={`/login?redirect=${redirectUrl}`} onClick={() => setModal(false)}>
                <button className="btn-ghost" style={{ width: "100%", padding: "12px", fontSize: 14 }}>
                  Already have an account? Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
