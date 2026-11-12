/**
 * Line-then-word diff for the "tracked changes" view.
 * Lines are aligned first; within a changed hunk, paired lines get an inline word diff
 * when they're similar enough, otherwise the old line is struck and the new one inserted whole.
 */

export type Seg = { k: "eq" | "ins" | "del"; s: string };
export type DLine = { k: "eq" | "ins" | "del" | "mod" | "gap"; segs: Seg[] };
export interface DiffResult { lines: DLine[]; ins: number; del: number }

type Op = { op: "eq" | "del" | "ins"; i?: number; j?: number };

function lcs<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): Op[] | null {
  const n = a.length, m = b.length;
  if (n * m > 4_000_000) return null; // pathological input — caller falls back to a whole replacement
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i * w + j] = same(a[i], b[j]) ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (same(a[i], b[j])) { ops.push({ op: "eq", i, j }); i++; j++; }
    else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) ops.push({ op: "del", i: i++ });
    else ops.push({ op: "ins", j: j++ });
  }
  while (i < n) ops.push({ op: "del", i: i++ });
  while (j < m) ops.push({ op: "ins", j: j++ });
  return ops;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const wc = (s: string) => words(s).length;

function wordDiff(a: string, b: string): { segs: Seg[]; similarity: number } | null {
  const wa = words(a), wb = words(b);
  const ops = lcs(wa, wb, (x, y) => x.toLowerCase() === y.toLowerCase());
  if (!ops) return null;
  const segs: Seg[] = [];
  let eq = 0;
  const push = (k: Seg["k"], s: string) => {
    const last = segs[segs.length - 1];
    if (last && last.k === k) last.s += " " + s; else segs.push({ k, s });
  };
  for (const o of ops) {
    if (o.op === "eq") { eq++; push("eq", wb[o.j!]); }
    else if (o.op === "del") push("del", wa[o.i!]);
    else push("ins", wb[o.j!]);
  }
  return { segs, similarity: (2 * eq) / Math.max(1, wa.length + wb.length) };
}

export function diffText(original: string, enhanced: string): DiffResult {
  const A = original.split("\n").map(s => s.trimEnd());
  const B = enhanced.split("\n").map(s => s.trimEnd());
  const lines: DLine[] = [];
  let ins = 0, del = 0;

  const addDel = (s: string) => { del += wc(s); lines.push({ k: "del", segs: [{ k: "del", s }] }); };
  const addIns = (s: string) => { ins += wc(s); lines.push({ k: "ins", segs: [{ k: "ins", s }] }); };

  const ops = lcs(A, B, (x, y) => norm(x).toLowerCase() === norm(y).toLowerCase());
  if (!ops) {
    A.filter(norm).forEach(addDel); B.filter(norm).forEach(addIns);
    return { lines, ins, del };
  }

  let dels: string[] = [], inss: string[] = [];
  const flush = () => {
    const n = Math.max(dels.length, inss.length);
    for (let x = 0; x < n; x++) {
      const d = dels[x], i = inss[x];
      if (d !== undefined && i !== undefined && norm(d) && norm(i)) {
        const wd = wordDiff(d, i);
        if (wd && wd.similarity >= 0.4) {
          for (const s of wd.segs) { if (s.k === "ins") ins += wc(s.s); if (s.k === "del") del += wc(s.s); }
          lines.push({ k: "mod", segs: wd.segs });
          continue;
        }
      }
      if (d !== undefined && norm(d)) addDel(d);
      if (i !== undefined && norm(i)) addIns(i);
    }
    dels = []; inss = [];
  };

  for (const o of ops) {
    if (o.op === "del") dels.push(A[o.i!]);
    else if (o.op === "ins") inss.push(B[o.j!]);
    else {
      flush();
      const s = B[o.j!];
      lines.push(norm(s) ? { k: "eq", segs: [{ k: "eq", s }] } : { k: "gap", segs: [] });
    }
  }
  flush();
  return { lines, ins, del };
}
