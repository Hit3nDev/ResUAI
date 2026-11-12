"use client";
import { usePathname } from "next/navigation";
import { ArrowRight, Download, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import type { Fmt } from "@/lib/api";
import { Spinner } from "@/components/ui";

interface Props {
  attemptId: number | null;
  onDownload: (format: Fmt) => Promise<void> | void;
}

const FORMATS: { fmt: Fmt; label: string; ext: string }[] = [
  { fmt: "docx", label: "Word",  ext: ".docx" },
  { fmt: "pdf",  label: "PDF",   ext: ".pdf" },
  { fmt: "txt",  label: "Text",  ext: ".txt" },
];

/**
 * Download buttons. Signed-out visitors get a sign-in prompt instead of a file;
 * signed-in users get the file through an authenticated fetch (see api.downloadFile).
 */
export default function DownloadGate({ attemptId, onDownload }: Props) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState<Fmt | null>(null);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  async function go(fmt: Fmt) {
    if (!user) { setModal(true); return; }
    if (!attemptId || busy) return;
    setBusy(fmt);
    try { await onDownload(fmt); }
    catch (e: any) { toast.error(e.message || "Download failed"); }
    finally { setBusy(null); }
  }

  const redirect = encodeURIComponent(pathname || "/");

  return (
    <>
      <div style={{ display: "inline-flex", gap: 6 }} role="group" aria-label="Download">
        {FORMATS.map(({ fmt, label, ext }) => (
          <button key={fmt} onClick={() => go(fmt)} disabled={!attemptId || !!busy}
            className={`btn btn-sm ${fmt === "docx" ? "btn-ink" : "btn-line"}`}
            aria-label={`Download as ${label} ${ext}`}>
            {busy === fmt ? <Spinner /> : user ? <Download size={14} /> : <Lock size={13} />} {label}
          </button>
        ))}
      </div>

      {modal && createPortal(
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="gate-title"
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal">
            <button onClick={() => setModal(false)} aria-label="Close" className="btn btn-quiet btn-sm" style={{ position: "absolute", top: 12, right: 12, width: 32, padding: 0 }}>
              <X size={18} />
            </button>
            <h2 id="gate-title" className="display" style={{ fontSize: 56, margin: "6px 0 14px" }}>Sign in to download</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 22 }}>
              Your resume is ready and saved to this session. A free account lets you download it as Word or PDF and find it again in your library.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <Link href={`/signup?redirect=${redirect}`} className="btn btn-blue btn-lg btn-block" onClick={() => setModal(false)}>
                Create a free account <ArrowRight size={16} />
              </Link>
              <Link href={`/login?redirect=${redirect}`} className="btn btn-line btn-block" onClick={() => setModal(false)}>
                I already have one
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
