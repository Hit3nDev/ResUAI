import Link from "next/link";
import AppShell from "@/components/AppShell";

export default function NotFound() {
  return (
    <AppShell title="Not found">
      <div style={{ padding: "56px 28px 80px" }}>
        <h2 className="display" style={{ fontSize: "clamp(120px, 24vw, 340px)", lineHeight: .8, margin: 0 }}>
          <span style={{ textDecoration: "line-through", textDecorationColor: "var(--blue)", textDecorationThickness: ".08em", color: "#B2B7C5" }}>404</span>
        </h2>
        <p style={{ fontSize: 22, fontWeight: 700, margin: "28px 0 6px" }}>This page was cut.</p>
        <p style={{ color: "var(--ink-2)", maxWidth: 420, margin: "0 0 26px" }}>Nothing lives at this address. Head back to the start, or open the builder.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-blue btn-lg">Back home</Link>
          <Link href="/builder" className="btn btn-line btn-lg">Open the builder</Link>
        </div>
      </div>
    </AppShell>
  );
}
