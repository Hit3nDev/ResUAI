import Link from "next/link";
import { ReactNode } from "react";
import Logo from "@/components/Logo";

/** Auth layout: a cobalt panel of verbs on the left, the form on the right. */
export default function AuthShell({ title, lede, children, footer }: {
  title: string; lede: string; children: ReactNode; footer: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Link href="/" style={{ textDecoration: "none", width: "fit-content" }} aria-label="ResUAI home"><Logo tone="light" size={26} mark="#0A0A0F" /></Link>
        <div className="verbs display" aria-hidden>
          <span>Led</span><span>Built</span><span>Shipped</span><span>Cut</span><span><b className="hl">Hired.</b></span>
        </div>
        <p style={{ maxWidth: 360, fontSize: 15, margin: 0 }}>
          A free account lets you download your resumes as Word or PDF, and keeps every draft in your library.
        </p>
      </aside>

      <main className="auth-form">
        <div style={{ width: "100%", maxWidth: 380 }}>
          <Link href="/" className="m-only" style={{ marginBottom: 28 }} aria-label="ResUAI home"><Logo size={24} /></Link>
          <h1 className="display" style={{ fontSize: 76, margin: "0 0 14px" }}>{title}</h1>
          <p style={{ color: "var(--ink-2)", margin: "0 0 28px" }}>{lede}</p>
          {children}
          <div style={{ marginTop: 24, fontSize: 14.5, color: "var(--ink-2)" }}>{footer}</div>
          <div style={{ marginTop: 30 }}><Link href="/" className="link" style={{ fontSize: 13.5, fontWeight: 600 }}>← Back to ResUAI</Link></div>
        </div>
      </main>
    </div>
  );
}
