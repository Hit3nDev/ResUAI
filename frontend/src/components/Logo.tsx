// Mark: three resume lines, the last one picked out with a highlighter.
export default function Logo({ tone = "dark", size = 24, mark = "#2340F5" }: { tone?: "dark" | "light"; size?: number; mark?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, lineHeight: 1 }} aria-label="ResUAI">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill={mark} />
        <rect x="5" y="6" width="14" height="2.4" fill="#fff" />
        <rect x="5" y="10.8" width="14" height="2.4" fill="#fff" />
        <rect x="5" y="15.6" width="9" height="2.8" fill="#FFE94A" />
      </svg>
      <span style={{ fontSize: size * 0.82, fontWeight: 800, fontStretch: "88%", letterSpacing: "-0.02em", color: tone === "light" ? "#fff" : "var(--ink)" }}>
        ResUAI
      </span>
    </span>
  );
}
