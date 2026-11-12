"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Gauge, Highlighter, Lock, RefreshCw, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/AppShell";
import ATSReport, { ATSData } from "@/components/ATSReport";
import { ResumeText } from "@/components/ResumeSheet";
import { EmptyCanvas, Segmented, Spinner } from "@/components/ui";
import { Attempt, SavedResume, clearHistory, deleteAttempt, downloadFromHistory, getHistory, getMyResumes } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type Kind = "create" | "enhance" | "ats" | "saved";
interface Item { key: string; kind: Kind; attemptId: number | null; title: string; sub: string; date: string; score: number | null; text: string; meta: ATSData | null }

const FILTERS = ["All", "Built", "Enhanced", "Scored"] as const;
const KIND_OF: Record<string, Kind> = { "Create Resume": "create", "Enhance Resume": "enhance", "ATS Checker": "ats" };
const FILTER_KIND: Record<string, Kind | null> = { All: null, Built: "create", Enhanced: "enhance", Scored: "ats" };
const fmtDate = (s?: string) => (s ? s.slice(0, 16).replace("T", " ") : "");

function toItem(a: Attempt): Item {
  const kind = KIND_OF[a.feature] ?? "create";
  const parts = (a.input_summary || "").split(" | ");
  let meta: ATSData | null = null;
  if (kind === "ats" && a.metadata) { try { const m = JSON.parse(a.metadata); if (m && typeof m.overall_score !== "undefined") meta = m; } catch {} }
  return {
    key: `a${a.id}`, kind, attemptId: a.id,
    title: kind === "create" ? (parts[0] || "Resume") : kind === "enhance" ? "Enhanced resume" : "ATS check",
    sub: kind === "create" ? (parts[1] || "Built from scratch") : (a.input_summary || ""),
    date: a.timestamp, score: a.ats_score, text: a.full_output || "", meta,
  };
}

function Icon({ k }: { k: Kind }) {
  return <span className="ticon" data-k={k} aria-hidden>{k === "ats" ? <Gauge size={17} /> : k === "enhance" ? <Highlighter size={17} /> : <FileText size={17} />}</span>;
}

export default function HistoryPage() {
  return <Suspense><Library /></Suspense>;
}

function Library() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tab: "all" | "saved" = params.get("tab") === "saved" ? "saved" : "all";
  const openId = params.get("open");

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(openId ? `a${openId}` : null);
  const [mview, setMview] = useState<"edit" | "preview">(openId ? "preview" : "edit");
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try { setAttempts(await getHistory()); } catch (e: any) { setFailed(true); toast.error(e.message || "Couldn’t load your library"); }
    if (user) { try { setSaved(await getMyResumes()); } catch {} } else setSaved([]);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const items: Item[] = useMemo(() => {
    if (tab === "saved") {
      return saved.map(r => ({ key: `s${r.id}`, kind: "saved" as Kind, attemptId: r.attempt_id, title: r.title, sub: "Saved to library", date: r.created_at, score: null, text: r.resume_data, meta: null }));
    }
    const k = FILTER_KIND[filter];
    return attempts.map(toItem).filter(i => (!k || i.kind === k) && (!q || `${i.title} ${i.sub}`.toLowerCase().includes(q.toLowerCase())));
  }, [tab, saved, attempts, filter, q]);

  // Desktop: always have something open
  useEffect(() => {
    if (loading) return;
    if (sel && items.some(i => i.key === sel)) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) setSel(items[0]?.key ?? null);
    else setSel(null);
  }, [items, sel, loading]);

  const cur = items.find(i => i.key === sel) ?? null;
  const select = (key: string) => { setSel(key); setMview("preview"); setConfirmDel(false); };

  async function del() {
    if (!cur || cur.attemptId == null || cur.kind === "saved") return;
    try { await deleteAttempt(cur.attemptId); toast.success("Deleted."); setConfirmDel(false); setSel(null); setMview("edit"); load(); }
    catch (e: any) { toast.error(e.message || "Couldn’t delete"); }
  }
  async function delAll() {
    try { await clearHistory(); toast.success("Library cleared."); setConfirmAll(false); setSel(null); load(); }
    catch (e: any) { toast.error(e.message || "Couldn’t clear"); }
  }
  async function dl(fmt: "docx" | "pdf" | "txt") {
    if (cur?.attemptId == null) return;
    try { await downloadFromHistory(cur.attemptId, fmt); } catch (e: any) { toast.error(e.message || "Download failed"); }
  }

  return (
    <AppShell title="Library" sub={`${attempts.length} session${attempts.length === 1 ? "" : "s"}`}
      actions={<button className="btn btn-quiet btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>}>
      <div className="ws" data-view={mview}>
        {/* ── List ─────────────────────────────────────────────────────── */}
        <section className="ws-form" aria-label="Sessions">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 10 }}>
            {user && (
              <Segmented label="List" value={tab} onChange={v => { setSel(null); router.replace(v === "saved" ? "/history?tab=saved" : "/history"); }}
                options={[{ value: "all", label: "All sessions" }, { value: "saved", label: `Saved (${saved.length})` }]} />
            )}
            {tab === "all" && (
              <>
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--ink-3)" }} aria-hidden />
                  <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search sessions" />
                </div>
                <div role="group" aria-label="Filter by tool" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {FILTERS.map(x => <button key={x} className="chip" aria-pressed={filter === x} onClick={() => setFilter(x)}>{x}</button>)}
                </div>
              </>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} role="listbox" aria-label="Sessions">
            {loading ? (
              <div style={{ display: "grid", placeItems: "center", padding: 56 }}><Spinner /></div>
            ) : failed ? (
              <p className="small" style={{ padding: 24 }}>Can’t reach the backend. Start the API on port 8000 and refresh.</p>
            ) : items.length === 0 ? (
              <p className="small" style={{ padding: 24 }}>
                {tab === "saved" ? "Nothing saved yet. Generate a resume and press Save." : attempts.length ? "No matches." : "Nothing here yet. Build, enhance or score a resume and it shows up here."}
              </p>
            ) : items.map(i => (
              <button key={i.key} className="lrow" role="option" aria-selected={sel === i.key} onClick={() => select(i.key)}>
                <Icon k={i.kind} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</b>
                  <span className="small" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.sub} · {fmtDate(i.date)}</span>
                </span>
                {i.score != null && <b className="num" style={{ fontSize: 15 }}>{i.score}</b>}
              </button>
            ))}
          </div>

          {tab === "all" && attempts.length > 0 && !loading && (
            <div className="ws-foot" style={{ justifyContent: "flex-end" }}>
              {confirmAll ? (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span className="small">Delete everything?</span>
                  <button className="btn btn-danger btn-sm" onClick={delAll}>Yes, clear</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setConfirmAll(false)}>Cancel</button>
                </span>
              ) : (
                <button className="btn btn-quiet btn-sm" onClick={() => setConfirmAll(true)}><Trash2 size={14} /> Clear all</button>
              )}
            </div>
          )}
        </section>

        {/* ── Detail ───────────────────────────────────────────────────── */}
        <section className="ws-canvas" aria-label="Details">
          {cur ? (
            <>
              <div className="detail-head">
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <button className="btn btn-quiet btn-sm m-only" onClick={() => setMview("edit")} aria-label="Back to list"><ArrowLeft size={16} /></button>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 16 }}>{cur.title}</b>
                    <span className="small">{cur.sub} · {fmtDate(cur.date)}</span>
                  </div>
                </div>
                <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {cur.attemptId != null && (user ? (
                    (["docx", "pdf", "txt"] as const).map(f => (
                      <button key={f} className="btn btn-line btn-sm" onClick={() => dl(f)}><Download size={13} /> {f.toUpperCase()}</button>
                    ))
                  ) : (
                    <Link href="/login?redirect=/history" className="btn btn-line btn-sm"><Lock size={12} /> Sign in to download</Link>
                  ))}
                  {cur.kind !== "saved" && (confirmDel ? (
                    <>
                      <button className="btn btn-danger btn-sm" onClick={del}>Yes, delete</button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(false)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Delete</button>
                  ))}
                </div>
              </div>
              <div className="artboard">
                {cur.kind === "ats"
                  ? (cur.meta ? <ATSReport r={cur.meta} /> : <article className="sheet sheet-letter" style={{ fontFamily: "monospace", fontSize: 13 }}>{cur.text}</article>)
                  : <ResumeText text={cur.text} />}
              </div>
            </>
          ) : (
            <div className="artboard" style={{ paddingTop: 60 }}>
              <EmptyCanvas title="Pick a session">Choose something from the list to read it, download it again, or delete it.</EmptyCanvas>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
