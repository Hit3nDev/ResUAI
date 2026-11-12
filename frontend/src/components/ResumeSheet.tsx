import { ReactNode } from "react";
import type { DLine } from "@/lib/diff";

/**
 * A resume laid out as a page. The plain-text resume the model returns is parsed with
 * the same heuristics as the DOCX/PDF generator (name, contact, ALL-CAPS sections,
 * bullets, "Company ....... Dates" rows) so the preview matches the exported file.
 */

export type Block =
  | { k: "name" | "contact" | "section" | "li" | "txt" | "sub"; t: string; ph?: boolean }
  | { k: "head"; t: string; r: string; ph?: boolean }
  | { k: "skill"; label: string; t: string; ph?: boolean };

const SECTION = /^[A-Z][A-Z0-9\s&/\-,]{2,39}$/;
const DIVIDER = /^[-=_]{3,}\s*$/;
const BULLET  = /^(?:[••–*]|-)\s+/;
const DATE_TAIL = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{2,4}.*|\b(?:19|20)\d{2}\s*[–-]\s*(?:(?:19|20)\d{2}|Present|Current).*|\bPresent\b.*)$/i;

function splitDate(line: string): [string, string] | null {
  const pipe = line.lastIndexOf("|");
  if (pipe > 0 && DATE_TAIL.test(line.slice(pipe + 1).trim())) return [line.slice(0, pipe).trim(), line.slice(pipe + 1).trim()];
  const gap = /\s{2,}|\t/.exec(line);
  if (gap) {
    const right = line.slice(gap.index).trim();
    if (DATE_TAIL.test(right)) return [line.slice(0, gap.index).trim(), right];
  }
  const m = DATE_TAIL.exec(line);
  if (m && m.index > 2 && /[,(\-–]\s*$|\s$/.test(line.slice(0, m.index))) {
    return [line.slice(0, m.index).replace(/[\s,(\-–]+$/, ""), m[0].replace(/\)$/, "")];
  }
  return null;
}

export function parseResume(text: string): Block[] {
  const out: Block[] = [];
  let sec = "";
  let sawName = false, sawContact = false;
  for (const raw of (text || "").split("\n")) {
    const s = raw.trim();
    if (!s || DIVIDER.test(s)) continue;
    if (!sawName) { out.push({ k: "name", t: s }); sawName = true; continue; }
    if (!sec && !sawContact && /@|\||\+?\d[\d\s()\-.]{7,}|linkedin|github/i.test(s)) { out.push({ k: "contact", t: s }); sawContact = true; continue; }
    if (SECTION.test(s) && s === s.toUpperCase() && !BULLET.test(s)) { sec = s; out.push({ k: "section", t: s }); continue; }
    if (BULLET.test(s)) { out.push({ k: "li", t: s.replace(BULLET, "") }); continue; }
    if (/SKILL/.test(sec) && s.includes(":")) {
      const i = s.indexOf(":");
      out.push({ k: "skill", label: s.slice(0, i).trim(), t: s.slice(i + 1).trim() }); continue;
    }
    const prev = out[out.length - 1];
    const d = sec && !/SUMMARY|OBJECTIVE|PROFILE|ABOUT/.test(sec) ? splitDate(s) : null;
    if (d) { out.push({ k: "head", t: d[0], r: d[1] }); continue; }
    if (prev && prev.k === "head") { out.push({ k: "sub", t: s }); continue; }
    out.push({ k: "txt", t: s });
  }
  return out;
}

export function ResumeSheet({ blocks, mark }: { blocks: Block[]; mark?: (s: string) => ReactNode }) {
  const m = (s: string) => (mark ? mark(s) : s);
  return (
    <article className="sheet" aria-label="Resume">
      {blocks.map((b, i) => {
        const ph = b.ph ? "ph" : "";
        switch (b.k) {
          case "name":    return <div key={i} className={`r-name ${ph}`}>{b.t}</div>;
          case "contact": return <div key={i} className={`r-contact ${ph}`}>{m(b.t)}</div>;
          case "section": return <div key={i} className="r-sec">{b.t}</div>;
          case "head":    return <div key={i} className={`r-head ${ph}`}><span>{m(b.t)}</span><span>{b.r}</span></div>;
          case "sub":     return <div key={i} className={`r-sub ${ph}`}>{m(b.t)}</div>;
          case "li":      return <div key={i} className={`r-li ${ph}`}><span>{m(b.t)}</span></div>;
          case "skill":   return <div key={i} className={`r-txt ${ph}`}><b>{b.label}:</b> {m(b.t)}</div>;
          default:        return <div key={i} className={`r-txt ${ph}`}>{m(b.t)}</div>;
        }
      })}
    </article>
  );
}

export function ResumeText({ text, mark }: { text: string; mark?: (s: string) => ReactNode }) {
  return <ResumeSheet blocks={parseResume(text)} mark={mark} />;
}

/** Tracked-changes view: insertions highlighted, deletions struck through. */
export function DiffSheet({ lines }: { lines: DLine[] }) {
  return (
    <article className="sheet diff" aria-label="Tracked changes">
      {lines.map((l, i) => {
        if (l.k === "gap") return <div key={i} className="dl gap" />;
        return (
          <div key={i} className="dl">
            {l.segs.map((s, j) => {
              const sp = j < l.segs.length - 1 ? " " : "";
              if (s.k === "ins") return <span key={j}><ins>{s.s}</ins>{sp}</span>;
              if (s.k === "del") return <span key={j}><del>{s.s}</del>{sp}</span>;
              return <span key={j}>{s.s}{sp}</span>;
            })}
          </div>
        );
      })}
    </article>
  );
}

/** Wrap occurrences of `keywords` in <mark>. */
export function markKeywords(keywords: string[]): ((s: string) => ReactNode) | undefined {
  const ks = Array.from(new Set(keywords.map(k => k.trim()).filter(k => k.length > 1)))
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!ks.length) return undefined;
  let re: RegExp;
  try { re = new RegExp(`(?<![A-Za-z0-9])(${ks.join("|")})(?![A-Za-z0-9])`, "gi"); } catch { return undefined; }
  return (s: string) => {
    const parts = s.split(re);
    return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
  };
}
