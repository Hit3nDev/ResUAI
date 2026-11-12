"use client";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Meter, scoreTone } from "@/components/ui";

export interface ATSData {
  overall_score: number; keyword_score: number; format_score: number; relevance_score: number;
  matched_keywords?: string[]; missing_keywords?: string[]; strengths?: string[]; improvements?: string[];
  section_scores?: Record<string, number>; verdict?: string;
}

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0, t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Sub({ label, value }: { label: string; value: number }) {
  const v = clamp(value);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
        <span className="num" style={{ fontWeight: 800, color: scoreTone(v) }}>{v}</span>
      </div>
      <Meter value={v} color={scoreTone(v)} label={label} />
    </div>
  );
}

export default function ATSReport({ r }: { r: ATSData }) {
  const score = clamp(r.overall_score);
  const shown = useCountUp(score);
  const tone = scoreTone(score);
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setDone(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const fixes = r.improvements ?? [];
  const secs = Object.entries(r.section_scores ?? {});

  return (
    <article className="report" aria-label="ATS report">
      <div className="rp-block" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px 36px", alignItems: "end" }}>
        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Overall match</div>
          <div className="display big-score num" style={{ color: tone }} aria-label={`Score ${score} out of 100`}>{shown}</div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <span className="verdict" style={{ background: tone }}>{r.verdict || (score >= 75 ? "Strong" : score >= 55 ? "Fair" : "Weak")}</span>
          <div className="small" style={{ margin: "10px 0 14px" }}>out of 100 against this job ad</div>
          <Meter value={score} color={tone} label="Overall" />
        </div>
      </div>

      <div className="rp-block">
        <div className="rp-title">Breakdown</div>
        <div style={{ display: "grid", gap: 18 }}>
          <Sub label="Keyword match" value={r.keyword_score} />
          <Sub label="Format" value={r.format_score} />
          <Sub label="Relevance to the role" value={r.relevance_score} />
        </div>
        {secs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, secs.length)}, 1fr)`, border: "1px solid var(--ink)", marginTop: 22 }}>
            {secs.map(([k, v], i) => (
              <div key={k} style={{ padding: "12px 14px", borderLeft: i ? "1px solid var(--ink)" : 0 }}>
                <div className="display num" style={{ fontSize: 40, color: scoreTone(clamp(v)) }}>{clamp(v)}</div>
                <div className="small" style={{ fontWeight: 700, textTransform: "capitalize", color: "var(--ink)" }}>{k}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rp-block" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 26 }}>
        <div>
          <div className="rp-title">Keywords in your resume</div>
          {r.matched_keywords?.length
            ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{r.matched_keywords.map((k, i) => <span key={i} className="chip chip-ok"><Check size={12} strokeWidth={3} />{k}</span>)}</div>
            : <p className="small">None of the ad’s keywords were found.</p>}
        </div>
        <div>
          <div className="rp-title">Keywords to add</div>
          {r.missing_keywords?.length
            ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{r.missing_keywords.map((k, i) => <span key={i} className="chip chip-add"><Plus size={12} strokeWidth={3} />{k}</span>)}</div>
            : <p style={{ color: "var(--ok)", fontWeight: 700, fontSize: 14 }}>Nothing important is missing.</p>}
        </div>
      </div>

      {(r.strengths?.length || fixes.length) ? (
        <div className="rp-block" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
          {!!r.strengths?.length && (
            <div>
              <div className="rp-title">Working well</div>
              {r.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 14.5 }}>
                  <Check size={16} color="var(--ok)" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }} />{s}
                </div>
              ))}
            </div>
          )}
          {!!fixes.length && (
            <div>
              <div className="rp-title">Fix first <span className="small" style={{ fontWeight: 500 }}>· {done.size} of {fixes.length} done</span></div>
              {fixes.map((s, i) => (
                <div key={i} className="todo" data-done={done.has(i)} onClick={() => toggle(i)} role="checkbox" aria-checked={done.has(i)} tabIndex={0}
                  onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(i); } }}>
                  <span className="check" style={{ pointerEvents: "none" }}><input type="checkbox" checked={done.has(i)} readOnly tabIndex={-1} aria-hidden /></span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
