"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getHistory, getStats, deleteAttempt, clearHistory, downloadFromHistory } from "@/lib/api";
import { FileDown, Trash2, Clock, FileText, Zap, Target, RefreshCw, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

function FeatureBadge({ feature }: { feature: string }) {
  const map: Record<string, { color: string; icon: any }> = {
    "Create Resume":  { color: "#8B5CF6", icon: FileText },
    "Enhance Resume": { color: "#F59E0B", icon: Zap },
    "ATS Checker":    { color: "#00C896", icon: Target },
  };
  const { color = "#7A8BA8", icon: Icon = FileText } = map[feature] || {};
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${color}14`, border: `1px solid ${color}25`, fontSize: 11, fontWeight: 700, color }}>
      <Icon size={10} />
      {feature}
    </div>
  );
}

function ScorePill({ score }: { score?: number }) {
  if (!score) return null;
  const color = score >= 75 ? "#00C896" : score >= 55 ? "#0EA5E9" : score >= 35 ? "#F59E0B" : "#EF4444";
  return <span style={{ padding: "2px 10px", borderRadius: 20, background: `${color}14`, color, fontWeight: 700, fontSize: 12, border: `1px solid ${color}25` }}>{score}/100</span>;
}

export default function HistoryPage() {
  const [history, setHistory]   = useState<any[]>([]);
  const [stats, setStats]       = useState<any>(null);
  const [filter, setFilter]     = useState("All");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { user } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([getHistory(), getStats()]);
      setHistory(h);
      setStats(s);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function del(id: number) {
    await deleteAttempt(id);
    toast.success("Session deleted");
    load();
  }

  async function delAll() {
    if (!confirm("Delete all history? This cannot be undone.")) return;
    await clearHistory();
    toast.success("All history cleared");
    load();
  }

  const filtered = history.filter(a => {
    const matchFeature = filter === "All" || a.feature === filter;
    const matchSearch  = !search || (a.input_summary || "").toLowerCase().includes(search.toLowerCase());
    return matchFeature && matchSearch;
  });

  const statCards = [
    { label: "Total Sessions",   val: stats?.total ?? 0 },
    { label: "Resumes Created",  val: stats?.created ?? 0 },
    { label: "Enhanced",         val: stats?.enhanced ?? 0 },
    { label: "ATS Checks",       val: stats?.ats_checks ?? 0 },
    { label: "Avg ATS Score",    val: stats?.avg_ats_score ? String(stats.avg_ats_score) : "—", accent: true },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-[1320px] mx-auto px-6 py-10">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div className="sec-label">History</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8", marginBottom: 6 }}>
              Session History
            </h1>
            <p style={{ fontSize: 14, color: "#7A8BA8" }}>Every AI session is saved. Re-download resumes as DOCX or PDF anytime.</p>
          </div>
          <button onClick={load} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 28 }}>
          {statCards.map(s => (
            <div key={s.label} className="card-static" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: s.accent ? "#00C896" : "#E8EEF8", marginBottom: 3 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#3D5270", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", background: "#0C1525", borderRadius: 10, padding: 3 }}>
            {["All","Create Resume","Enhance Resume","ATS Checker"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: filter === f ? "#162034" : "transparent", color: filter === f ? "#E8EEF8" : "#7A8BA8",
              }}>
                {f}
              </button>
            ))}
          </div>
          <input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sessions..." style={{ maxWidth: 240, padding: "8px 12px", fontSize: 13 }} />
          <span style={{ fontSize: 12, color: "#3D5270", marginLeft: "auto" }}>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Sessions */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ width: 28, height: 28, margin: "0 auto" }} /></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
            <Clock size={40} color="#162034" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8EEF8", marginBottom: 8 }}>No sessions yet</div>
            <div style={{ fontSize: 13, color: "#3D5270" }}>Start by creating or enhancing a resume — all sessions appear here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(a => {
              const isOpen = expanded === a.id;
              const summary = (a.input_summary || "—").slice(0, 80);
              const preview = (a.output_preview || "").slice(0, 120).replace(/\n/g, " ");

              return (
                <div key={a.id} className="card" style={{ padding: 0, cursor: "default" }}>
                  {/* Row header */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#3D5270", minWidth: 28 }}>#{a.id}</span>
                    <FeatureBadge feature={a.feature} />
                    <span style={{ fontSize: 13, color: "#7A8BA8", flex: 1 }}>{summary}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ScorePill score={a.ats_score} />
                      <span style={{ fontSize: 12, color: "#3D5270" }}>{a.timestamp?.slice(0, 16)}</span>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #162034", padding: "16px 20px" }} className="animate-fade-in">
                      {/* Preview text */}
                      {preview && (
                        <div style={{ fontSize: 13, color: "#7A8BA8", marginBottom: 14, padding: "10px 12px", background: "#0C1525", borderRadius: 8, lineHeight: 1.65 }}>
                          {preview}{preview.length >= 120 ? "…" : ""}
                        </div>
                      )}

                      {/* Full output */}
                      {a.full_output && (
                        <div style={{ marginBottom: 14 }}>
                          <button onClick={() => { const el = document.getElementById(`full-${a.id}`); if (el) el.style.display = el.style.display === "none" ? "block" : "none"; }} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginBottom: 8 }}>
                            View Full Output
                          </button>
                          <div id={`full-${a.id}`} style={{ display: "none" }}>
                            <div className="resume-view" style={{ maxHeight: 280 }}>{a.full_output}</div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons — download gated behind auth */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {user ? (
                          <>
                            <button onClick={() => downloadFromHistory(a.id, "docx")} className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                              <FileDown size={13} /> DOCX
                            </button>
                            <button onClick={() => downloadFromHistory(a.id, "pdf")} className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                              <FileDown size={13} /> PDF
                            </button>
                            <button onClick={() => downloadFromHistory(a.id, "txt")} className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                              <FileDown size={13} /> TXT
                            </button>
                          </>
                        ) : (
                          <Link href={`/login?redirect=/history`}>
                            <button className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, color: "#FCD34D" }}>
                              <Lock size={12} /> Sign in to download
                            </button>
                          </Link>
                        )}
                        <button onClick={() => del(a.id)} className="btn-danger" style={{ padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Danger zone */}
        {history.length > 0 && (
          <div style={{ marginTop: 40, padding: "20px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FCA5A5", marginBottom: 10 }}>Danger Zone</div>
            <p style={{ fontSize: 13, color: "#7A8BA8", marginBottom: 14 }}>Permanently delete all sessions, files, and history. This cannot be undone.</p>
            <button onClick={delAll} className="btn-danger" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Trash2 size={13} /> Clear All History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
