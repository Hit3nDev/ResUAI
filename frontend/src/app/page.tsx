"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { FileText, Zap, Target, Download, ArrowRight, TrendingUp, Clock, CheckCircle, ChevronRight } from "lucide-react";
import { getStats } from "@/lib/api";

const features = [
  { icon: FileText, label: "Resume Builder", desc: "Build from scratch with guided form + AI generation", href: "/builder", accent: "#00C896" },
  { icon: Zap,      label: "AI Enhancer",    desc: "Rewrite with stronger verbs and quantified metrics", href: "/enhance", accent: "#0EA5E9" },
  { icon: Target,   label: "ATS Analyzer",   desc: "Score against job descriptions, close keyword gaps", href: "/ats",     accent: "#8B5CF6" },
  { icon: Download, label: "DOCX + PDF",     desc: "Export professionally formatted documents instantly", href: "/builder", accent: "#F59E0B" },
  { icon: Clock,    label: "Full History",   desc: "Every session saved, re-downloadable anytime",       href: "/history", accent: "#EC4899" },
];

const steps = [
  { n: "01", title: "Fill or Upload",   desc: "Complete the guided form or upload your existing resume" },
  { n: "02", title: "AI Generates",     desc: "Llama 3.3 70B crafts a polished, ATS-ready resume" },
  { n: "03", title: "Review & Edit",    desc: "Preview and adjust content before finalizing" },
  { n: "04", title: "Export",           desc: "Download as Word (.docx) or PDF in one click" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="badge badge-green animate-fade-up" style={{ marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", boxShadow: "0 0 6px #00C896" }} />
              Powered by Groq · Llama 3.3 70B · Free
            </div>

            <h1 className="animate-fade-up delay-100" style={{
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 900,
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              color: "#E8EEF8",
              marginBottom: 20,
            }}>
              Build Resumes<br />
              <span style={{ background: "linear-gradient(135deg, #00C896, #0EA5E9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                That Get You Hired
              </span>
            </h1>

            <p className="animate-fade-up delay-200" style={{ fontSize: 17, color: "#7A8BA8", lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              AI-powered resume creation, enhancement, and ATS scoring. Generate
              professional DOCX &amp; PDF documents in seconds — completely free.
            </p>

            <div className="flex flex-wrap gap-3 animate-fade-up delay-300">
              <Link href="/builder">
                <button className="btn-primary" style={{ padding: "13px 28px", fontSize: 15 }}>
                  Create Resume
                  <ArrowRight size={16} style={{ marginLeft: 8, display: "inline" }} />
                </button>
              </Link>
              <Link href="/enhance">
                <button className="btn-ghost" style={{ padding: "13px 28px", fontSize: 15 }}>
                  Enhance Existing
                </button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 animate-fade-up delay-400" style={{ marginTop: 36 }}>
              {["No account needed", "DOCX + PDF export", "ATS optimized", "Free forever"].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7A8BA8" }}>
                  <CheckCircle size={13} color="#00C896" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right — 3D layered UI preview */}
          <div className="hidden lg:flex items-center justify-center animate-fade-in delay-200" style={{ perspective: "1000px" }}>
            <div style={{ position: "relative", width: 420 }}>
              <div style={{
                position: "absolute", top: -20, right: -20,
                width: "100%", padding: "20px 24px",
                background: "#080F1C", border: "1px solid #162034", borderRadius: 14,
                transform: "rotateY(-8deg) rotateX(4deg)", opacity: 0.45,
              }}>
                <div style={{ height: 10, width: "60%", borderRadius: 4, background: "#162034", marginBottom: 8 }} />
                <div style={{ height: 8, width: "90%", borderRadius: 4, background: "#0C1525" }} />
              </div>
              <div style={{
                position: "absolute", top: -10, right: -10,
                width: "100%", padding: "20px 24px",
                background: "#080F1C", border: "1px solid #162034", borderRadius: 14,
                transform: "rotateY(-4deg) rotateX(2deg)", opacity: 0.65,
              }}>
                <div style={{ height: 10, width: "70%", borderRadius: 4, background: "#162034", marginBottom: 8 }} />
                <div style={{ height: 8, width: "85%", borderRadius: 4, background: "#0C1525" }} />
              </div>
              <div style={{
                position: "relative", zIndex: 2,
                background: "#080F1C",
                border: "1px solid rgba(0,200,150,0.2)",
                borderRadius: 16,
                padding: "24px 26px",
                boxShadow: "0 0 40px rgba(0,200,150,0.08), 0 8px 32px rgba(0,0,0,0.5)",
                animation: "float 4s ease-in-out infinite",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#00C896", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Resume</span>
                  <span className="badge badge-green">Ready</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#3D5270", marginBottom: 4, fontWeight: 600 }}>ATS Score</div>
                    <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #00C896, #0EA5E9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>87</div>
                    <div style={{ fontSize: 11, color: "#3D5270" }}>/100 · Excellent</div>
                  </div>
                  <div style={{ flex: 2 }}>
                    {[["Keyword Match", 92], ["Relevance", 85], ["Format", 90]].map(([l, v]) => (
                      <div key={String(l)} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#3D5270", marginBottom: 3 }}>
                          <span>{l}</span><span style={{ color: "#7A8BA8" }}>{v}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {["React", "TypeScript", "REST API", "Agile", "Git"].map(k => (
                    <span key={k} className="badge badge-green" style={{ fontSize: 10, padding: "2px 8px" }}>{k}</span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn-primary" style={{ flex: 1, padding: "9px 12px", fontSize: 12 }}>Download DOCX</button>
                  <button className="btn-ghost" style={{ flex: 1, padding: "9px 12px", fontSize: 12 }}>Export PDF</button>
                </div>
              </div>
              <div style={{
                position: "absolute", bottom: -28, left: -28,
                background: "#080F1C", border: "1px solid rgba(0,200,150,0.2)",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 8, zIndex: 3,
                animation: "float 3.5s ease-in-out infinite",
                animationDelay: "0.5s",
              }}>
                <TrendingUp size={14} color="#00C896" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#E8EEF8" }}>+40% more interviews</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      {stats && (
        <section style={{ borderTop: "1px solid #162034", borderBottom: "1px solid #162034", background: "#080F1C" }}>
          <div className="max-w-[1320px] mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { label: "Total Sessions",   val: stats.total },
              { label: "Resumes Built",    val: stats.created },
              { label: "Resumes Enhanced", val: stats.enhanced },
              { label: "ATS Checks",       val: stats.ats_checks },
              { label: "Avg ATS Score",    val: stats.avg_ats_score ? `${stats.avg_ats_score}` : "—", accent: true },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: s.accent ? "#00C896" : "#E8EEF8", marginBottom: 4 }}>{s.val ?? 0}</div>
                <div style={{ fontSize: 12, color: "#3D5270", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FIX 1: FEATURE CARDS — depth, inner gradient, refined hover
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1320px] mx-auto px-6 py-20">
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="sec-label" style={{ justifyContent: "center", marginBottom: 14 }}>Platform capabilities</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8" }}>
            Everything you need to land the job
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {features.map((f, i) => (
            <Link key={f.label} href={f.href} style={{ textDecoration: "none" }}>
              <div
                className="animate-fade-up"
                style={{
                  animationDelay: `${i * 0.07}s`,
                  height: "100%",
                  // Core card styling inspired by ZeBeyond reference
                  background: `linear-gradient(145deg, #0C1828 0%, #080F1C 60%, ${f.accent}06 100%)`,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderRadius: 16,
                  padding: "24px 22px",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
                  // Subtle top shimmer line
                  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 20px rgba(0,0,0,0.35)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.transform = "translateY(-4px)";
                  el.style.boxShadow = `0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px ${f.accent}22`;
                  el.style.borderColor = `${f.accent}30`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 20px rgba(0,0,0,0.35)";
                  el.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                {/* Subtle corner accent glow */}
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  width: 80, height: 80,
                  background: `radial-gradient(circle at top right, ${f.accent}10, transparent 70%)`,
                  pointerEvents: "none",
                }} />

                {/* Icon container */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${f.accent}14`,
                  border: `1px solid ${f.accent}28`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                  transition: "background 0.2s ease",
                }}>
                  <f.icon size={18} color={f.accent} strokeWidth={1.8} />
                </div>

                {/* Title — slightly larger, medium weight */}
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#E8EEF8",
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                }}>
                  {f.label}
                </div>

                {/* Description — 65% opacity for clear hierarchy */}
                <div style={{
                  fontSize: 12,
                  color: "rgba(203,213,225,0.62)",
                  lineHeight: 1.65,
                  marginBottom: 18,
                }}>
                  {f.desc}
                </div>

                {/* CTA link */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, color: f.accent, fontWeight: 600,
                  transition: "gap 0.2s ease",
                }}>
                  Open <ChevronRight size={12} strokeWidth={2.5} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FIX 2: WORKFLOW SECTION — visual timeline with connectors
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: "#080F1C",
        borderTop: "1px solid #162034",
        borderBottom: "1px solid #162034",
      }}>
        <div className="max-w-[1320px] mx-auto px-6 py-20">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="sec-label" style={{ justifyContent: "center", marginBottom: 14 }}>Workflow</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8" }}>
              From zero to hired in 4 steps
            </h2>
          </div>

          <div style={{ position: "relative" }}>
            {/* Horizontal connector line (desktop only) */}
            <div style={{
              position: "absolute",
              top: 20, left: "12.5%", right: "12.5%",
              height: 1,
              background: "linear-gradient(90deg, transparent, #162034 15%, #162034 85%, transparent)",
              display: "none",
            }} className="hidden md:block" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {steps.map((s, i) => (
                <div
                  key={s.n}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 0.1}s`, position: "relative" }}
                >
                  {/* Step number node */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{
                      width: 40, height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(0,200,150,0.15), rgba(0,200,150,0.05))",
                      border: "1px solid rgba(0,200,150,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 0 16px rgba(0,200,150,0.1)",
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: "#00C896",
                        letterSpacing: "0.05em",
                      }}>
                        {s.n}
                      </span>
                    </div>

                    {/* Connector line between nodes — inline, desktop */}
                    {i < steps.length - 1 && (
                      <div style={{
                        flex: 1,
                        height: 1,
                        background: "linear-gradient(90deg, rgba(0,200,150,0.25), rgba(22,32,52,0.6))",
                        display: "block",
                      }} className="hidden md:block" />
                    )}
                  </div>

                  {/* Step content */}
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#E8EEF8",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}>
                    {s.title}
                  </h3>
                  <p style={{
                    fontSize: 13,
                    color: "rgba(203,213,225,0.55)",
                    lineHeight: 1.7,
                  }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FIX 3: CTA SECTION — gradient bg, glow, premium padding
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1320px] mx-auto px-6 py-20">
        <div style={{
          position: "relative",
          padding: "60px 48px",
          textAlign: "center",
          borderRadius: 20,
          overflow: "hidden",
          // Multi-layer gradient background
          background: "linear-gradient(145deg, #0B1A2E 0%, #080F1C 40%, #071A14 100%)",
          border: "1px solid rgba(0,200,150,0.18)",
          // Outer glow
          boxShadow: "0 0 60px rgba(0,200,150,0.07), 0 0 120px rgba(0,200,150,0.04), 0 8px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Background radial glows */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 30% 50%, rgba(0,200,150,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(14,165,233,0.04) 0%, transparent 60%)",
          }} />

          {/* Top shimmer line */}
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,200,150,0.4), transparent)",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="badge badge-green" style={{ display: "inline-flex", marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", boxShadow: "0 0 6px #00C896" }} />
              Free — No sign-up required
            </div>

            <h2 style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#E8EEF8",
              marginBottom: 14,
              lineHeight: 1.1,
            }}>
              Ready to get hired faster?
            </h2>
            <p style={{
              fontSize: 16,
              color: "rgba(203,213,225,0.6)",
              marginBottom: 36,
              maxWidth: 480,
              margin: "0 auto 36px",
              lineHeight: 1.65,
            }}>
              ResUAI generates your first ATS-optimized resume in under 2 minutes.
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/builder">
                {/* Primary — solid with glow */}
                <button
                  className="btn-primary"
                  style={{ padding: "14px 32px", fontSize: 15 }}
                >
                  Build Your Resume
                  <ArrowRight size={15} style={{ display: "inline", marginLeft: 8 }} />
                </button>
              </Link>
              <Link href="/ats">
                {/* Secondary — clean outline */}
                <button style={{
                  padding: "14px 28px",
                  fontSize: 15,
                  fontWeight: 600,
                  background: "transparent",
                  color: "#E8EEF8",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,200,150,0.4)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#00C896";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.06)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#E8EEF8";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
                >
                  Check ATS Score
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #162034", padding: "24px 0" }}>
        <div className="max-w-[1320px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span style={{ fontSize: 13, fontWeight: 800, color: "#E8EEF8", letterSpacing: "-0.01em" }}>
            Resu<span style={{ color: "#00C896" }}>AI</span>
          </span>
          <span style={{ fontSize: 12, color: "#3D5270" }}>GenAI Intel Project · 2025 · Powered by Groq · Llama 3.3 70B</span>
        </div>
      </footer>
    </div>
  );
}
