"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Attempt, Stats, getHistory, getStats } from "@/lib/api";

const VERBS = ["Led", "Built", "Shipped", "Cut", "Grew", "Launched", "Fixed", "Scaled", "Taught", "Won", "Designed", "Saved", "Doubled", "Negotiated", "Cut costs"];

const TILES = [
  { href: "/builder", name: "Build",   text: "Answer a few questions. Get a full draft with the summary, bullets and skills written for you." },
  { href: "/enhance", name: "Enhance", text: "Upload the resume you have. Vague lines get rewritten, and every change is marked." },
  { href: "/ats",     name: "Score",   text: "Paste a job ad. Get a 0–100 match, the keywords you’re missing and what to fix first." },
];

const label = (f: string) => (f === "Create Resume" ? "Built" : f === "Enhance Resume" ? "Enhanced" : "Scored");

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Attempt[]>([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getHistory().then(h => setRecent(h.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <AppShell title="Home" titleAs="p">
      <section className="hero">
        <h1 aria-label="Responsible for becomes Led.">
          <span className="display weak" aria-hidden>Responsible for</span>
          <span className="display strong" aria-hidden>Led.</span>
        </h1>
        <div className="hero-copy">
          <p>
            ResUAI rewrites vague resume lines into specific ones, checks them against a job ad, and exports a clean Word or PDF.
          </p>
          <p className="small" style={{ fontSize: 13.5 }}>Free to use. You’ll need a free account to download files.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
            <Link href="/builder" className="btn btn-blue btn-lg">Start building <ArrowRight size={17} /></Link>
            <Link href="/ats" className="btn btn-line btn-lg">Score a resume</Link>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...VERBS, ...VERBS].map((v, i) => <span key={i}>{v}</span>)}
        </div>
      </div>

      <section className="tiles" aria-label="Tools">
        {TILES.map(t => (
          <Link key={t.href} href={t.href} className="tile">
            <div className="tile-top">
              <p>{t.text}</p>
              <ArrowUpRight className="arrow" size={28} strokeWidth={2} />
            </div>
            <h2 className="display">{t.name}</h2>
          </Link>
        ))}
      </section>

      <section className="recent" aria-label="Your workspace">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Recent</h2>
            <Link href="/history" className="small" style={{ fontWeight: 700, color: "var(--blue)" }}>Open library →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="small" style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>Nothing yet. Whatever you build, enhance or score shows up here.</p>
          ) : recent.map(a => (
            <Link key={a.id} href={`/history?open=${a.id}`} className="rrow">
              <span className="small" style={{ fontWeight: 700, color: "var(--ink)" }}>{label(a.feature)}</span>
              <b style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.input_summary || "—"}</b>
              <span className="small num">{a.ats_score != null ? `${a.ats_score}/100` : a.timestamp?.slice(5, 16)}</span>
            </Link>
          ))}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>In this workspace</h2>
          <div className="count-grid">
            <div><b className="num">{stats?.created ?? 0}</b><span className="small">resumes built</span></div>
            <div><b className="num">{stats?.enhanced ?? 0}</b><span className="small">enhanced</span></div>
            <div><b className="num">{stats?.ats_checks ?? 0}</b><span className="small">ATS checks</span></div>
            <div><b className="num">{stats?.avg_ats_score ?? "—"}</b><span className="small">average score</span></div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
