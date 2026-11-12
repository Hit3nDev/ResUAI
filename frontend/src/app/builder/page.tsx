"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/AppShell";
import DownloadGate from "@/components/DownloadGate";
import { ResumeSheet, ResumeText } from "@/components/ResumeSheet";
import { CanvasBar, Check, Field, Segmented, Select, Spinner, Stepper, TextArea, ViewSwitch, Working } from "@/components/ui";
import { createResume, CreateResult, downloadResume, saveResumeToAccount } from "@/lib/api";
import { draftBlocks } from "@/lib/draft";
import { useAuth } from "@/lib/AuthContext";

const LEVELS = ["Fresher / Entry Level", "1–3 Years", "3–7 Years", "7+ Years / Senior"];
const TONES  = ["Professional", "Conversational", "Confident & Bold", "Friendly"];

const STEPS = [
  { short: "Basics",     title: "Basics",         help: "How employers reach you." },
  { short: "Role",       title: "Target role",    help: "What you’re aiming for. The AI tunes the wording to it." },
  { short: "Experience", title: "Experience",     help: "Rough notes are fine. Add numbers wherever you have them." },
  { short: "Education",  title: "Education",      help: "Degrees, schools, grades." },
  { short: "Skills",     title: "Skills",         help: "Comma-separated lists." },
  { short: "Extras",     title: "Everything else", help: "Certifications, projects, languages, awards. One per line." },
  { short: "Letter",     title: "Cover letter",   help: "Optional. Written from the resume once it’s generated." },
];

interface Exp { company: string; title: string; duration: string; location: string; bullets: string }
interface Edu { degree: string; school: string; year: string; gpa: string }
interface Form {
  name: string; email: string; phone: string; loc: string; linkedin: string; site: string;
  role: string; level: string; summary: string;
  exps: Exp[]; edus: Edu[];
  tech: string; soft: string;
  certs: string; projects: string; langs: string; awards: string;
  genCL: boolean; company: string; tone: string; jd: string;
}

const blankExp = (): Exp => ({ company: "", title: "", duration: "", location: "", bullets: "" });
const blankEdu = (): Edu => ({ degree: "", school: "", year: "", gpa: "" });
const blank: Form = {
  name: "", email: "", phone: "", loc: "", linkedin: "", site: "",
  role: "", level: LEVELS[0], summary: "",
  exps: [blankExp()], edus: [blankEdu()],
  tech: "", soft: "", certs: "", projects: "", langs: "", awards: "",
  genCL: false, company: "", tone: TONES[0], jd: "",
};

const DRAFT_KEY = "resuai:builder:draft";
const RESULT_KEY = "resuai:builder:result";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const lines = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);
const csv   = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

export default function BuilderPage() {
  const { user } = useAuth();
  const [f, setF] = useState<Form>(blank);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [view, setView] = useState<"draft" | "ai" | "letter">("draft");
  const [mview, setMview] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v })), []);

  // Restore draft + last result (survives the sign-in detour and accidental reloads)
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setF({ ...blank, ...JSON.parse(d) });
      const r = sessionStorage.getItem(RESULT_KEY);
      if (r) { setResult(JSON.parse(r)); setView("ai"); }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [f, hydrated]);

  const setExp = (i: number, k: keyof Exp, v: string) => set("exps", f.exps.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const setEdu = (i: number, k: keyof Edu, v: string) => set("edus", f.edus.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const done = [
    !!(f.name.trim() && f.email.trim()),
    !!f.role.trim(),
    f.exps.some(e => e.company && e.title),
    f.edus.some(e => e.degree && e.school),
    !!(f.tech.trim() || f.soft.trim()),
    !!(f.certs.trim() || f.projects.trim() || f.langs.trim() || f.awards.trim()),
    f.genCL,
  ];
  const stepOf = (k: string) => (k === "name" || k === "email" ? 0 : k === "role" ? 1 : k.startsWith("exp") ? 2 : 3);
  const errSteps = STEPS.map((_, i) => Object.keys(errors).some(k => stepOf(k) === i));

  function validate() {
    const e: Record<string, string> = {};
    if (!f.name.trim())  e.name  = "Your name is required.";
    if (!f.email.trim()) e.email = "An email address is required.";
    else if (!EMAIL_RE.test(f.email.trim())) e.email = "That doesn’t look like an email address.";
    if (!f.role.trim())  e.role  = "Tell us the role you’re aiming for.";
    f.exps.forEach((x, i) => { if ((x.company || x.title) && !(x.company && x.title)) e[`exp${i}`] = "Add both a company and a job title, or clear this position."; });
    f.edus.forEach((x, i) => { if ((x.degree || x.school) && !(x.degree && x.school)) e[`edu${i}`] = "Add both a degree and an institution, or clear this entry."; });
    setErrors(e);
    return e;
  }

  async function generate() {
    const e = validate();
    const keys = Object.keys(e);
    if (keys.length) {
      toast.error(e[keys[0]]);
      setStep(Math.min(...keys.map(stepOf)));
      setMview("edit");
      return;
    }
    setLoading(true); setSaved(false);
    const tid = toast.loading("Writing your resume…");
    try {
      const res = await createResume({
        personal: { name: f.name.trim(), email: f.email.trim(), phone: f.phone, location: f.loc, linkedin: f.linkedin, website: f.site },
        target_role: f.role.trim(), experience_level: f.level, summary_hint: f.summary,
        experiences: f.exps.filter(x => x.company || x.title).map(x => ({ ...x, bullets: lines(x.bullets) })),
        education:   f.edus.filter(x => x.degree || x.school),
        skills: { technical: csv(f.tech), soft: csv(f.soft) },
        certifications: lines(f.certs), projects: lines(f.projects), languages: lines(f.langs), achievements: lines(f.awards),
        generate_cover_letter: f.genCL, company_name: f.company, cover_tone: f.tone, job_description: f.jd,
      });
      setResult(res); setView("ai"); setMview("preview");
      try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(res)); } catch {}
      toast.success(`Done. ${res.word_count} words.`, { id: tid });
      if (f.genCL && !res.cover_letter) toast.error("The resume is ready, but the cover letter wasn’t written.", { duration: 6000 });
    } catch (err: any) {
      toast.error(err.message || "Generation failed", { id: tid });
    } finally { setLoading(false); }
  }

  async function saveToAccount() {
    if (!result) return;
    try {
      await saveResumeToAccount(result.attempt_id, `${f.name || "My"} — ${f.role || "Resume"}`, result.resume_text);
      setSaved(true); toast.success("Saved to your library.");
    } catch (e: any) { toast.error(e.message || "Couldn’t save"); }
  }

  function reset() {
    setF(blank); setResult(null); setErrors({}); setSaved(false); setStep(0); setView("draft"); setConfirmReset(false);
    try { localStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(RESULT_KEY); } catch {}
  }

  const blocks = useMemo(() => draftBlocks(f), [f]);
  const S = STEPS[step];

  return (
    <AppShell title="Build" sub={f.name.trim() ? `${f.name.trim()}${f.role.trim() ? " · " + f.role.trim() : ""}` : "New resume"}
      actions={
        <button className="btn btn-blue" onClick={generate} disabled={loading}>
          {loading ? <><Spinner /> Writing…</> : result ? "Regenerate" : "Generate resume"}
        </button>
      }>
      <ViewSwitch value={mview} onChange={setMview} a="Edit" b="Preview" />

      <div className="ws" data-view={mview}>
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <section className="ws-form" aria-label="Resume details">
          <div className="ws-scroll">
            <Stepper labels={STEPS.map(s => s.short)} current={step} done={done} err={errSteps} onGo={setStep} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <h2 className="h-step">{S.title}</h2>
              {confirmReset ? (
                <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-danger btn-sm" onClick={reset}>Clear all</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>Keep</button>
                </span>
              ) : (
                <button className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(true)} style={{ flexShrink: 0 }}>Reset</button>
              )}
            </div>
            <p className="small" style={{ margin: "0 0 22px" }}>{S.help}</p>

            <div key={step} className="step-body">
              {step === 0 && (
                <div className="grid2">
                  <Field label="Full name" required value={f.name} onChange={v => set("name", v)} placeholder="Alex Johnson" error={errors.name} autoComplete="name" />
                  <Field label="Email" required type="email" value={f.email} onChange={v => set("email", v)} placeholder="alex@email.com" error={errors.email} autoComplete="email" />
                  <Field label="Phone" value={f.phone} onChange={v => set("phone", v)} placeholder="+91 98765 43210" autoComplete="tel" />
                  <Field label="Location" value={f.loc} onChange={v => set("loc", v)} placeholder="New Delhi, India" />
                  <Field label="LinkedIn" value={f.linkedin} onChange={v => set("linkedin", v)} placeholder="linkedin.com/in/alex" />
                  <Field label="Portfolio / GitHub" value={f.site} onChange={v => set("site", v)} placeholder="github.com/alex" />
                </div>
              )}

              {step === 1 && (
                <div className="col">
                  <Field label="Job title you’re aiming for" required value={f.role} onChange={v => set("role", v)} placeholder="Software Engineer" error={errors.role} />
                  <Select label="Experience level" value={f.level} onChange={v => set("level", v)} options={LEVELS} />
                  <TextArea label="Summary hint" optional rows={3} value={f.summary} onChange={v => set("summary", v)}
                    placeholder="A line or two about your background."
                    hint="Leave it blank and the AI writes the summary." />
                </div>
              )}

              {step === 2 && (
                <div>
                  {f.exps.map((x, i) => (
                    <div key={i} className="subpanel">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <b style={{ fontSize: 13 }}>Position {i + 1}{i === 0 ? " · most recent" : ""}</b>
                        {f.exps.length > 1 && (
                          <button className="btn btn-quiet btn-sm" onClick={() => set("exps", f.exps.filter((_, j) => j !== i))} aria-label={`Remove position ${i + 1}`}>
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid2">
                        <Field label="Company"   value={x.company}  onChange={v => setExp(i, "company", v)}  placeholder="Google" />
                        <Field label="Job title" value={x.title}    onChange={v => setExp(i, "title", v)}    placeholder="Software Engineer" />
                        <Field label="Dates"     value={x.duration} onChange={v => setExp(i, "duration", v)} placeholder="Jan 2022 – Present" />
                        <Field label="Location"  value={x.location} onChange={v => setExp(i, "location", v)} placeholder="Bangalore" />
                        <TextArea className="span2" label="What you did" hint="One per line." rows={4} value={x.bullets} onChange={v => setExp(i, "bullets", v)}
                          placeholder={"Built REST APIs serving 10,000+ daily users\nCut query time 40% by adding indexes"} />
                      </div>
                      {errors[`exp${i}`] && <div className="err" role="alert">{errors[`exp${i}`]}</div>}
                    </div>
                  ))}
                  {f.exps.length < 5 && <button className="btn btn-line btn-sm" onClick={() => set("exps", [...f.exps, blankExp()])}><Plus size={14} /> Add position</button>}
                </div>
              )}

              {step === 3 && (
                <div>
                  {f.edus.map((x, i) => (
                    <div key={i} className="subpanel">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <b style={{ fontSize: 13 }}>Education {i + 1}</b>
                        {f.edus.length > 1 && (
                          <button className="btn btn-quiet btn-sm" onClick={() => set("edus", f.edus.filter((_, j) => j !== i))} aria-label={`Remove education ${i + 1}`}>
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid2">
                        <Field label="Degree"      value={x.degree} onChange={v => setEdu(i, "degree", v)} placeholder="B.Tech, Computer Science" />
                        <Field label="Institution" value={x.school} onChange={v => setEdu(i, "school", v)} placeholder="IIT Delhi" />
                        <Field label="Year"        value={x.year}   onChange={v => setEdu(i, "year", v)}   placeholder="2023" />
                        <Field label="GPA / grade" value={x.gpa}    onChange={v => setEdu(i, "gpa", v)}    placeholder="8.7 / 10" />
                      </div>
                      {errors[`edu${i}`] && <div className="err" role="alert">{errors[`edu${i}`]}</div>}
                    </div>
                  ))}
                  {f.edus.length < 4 && <button className="btn btn-line btn-sm" onClick={() => set("edus", [...f.edus, blankEdu()])}><Plus size={14} /> Add education</button>}
                </div>
              )}

              {step === 4 && (
                <div className="col">
                  <TextArea label="Technical" rows={3} value={f.tech} onChange={v => set("tech", v)} placeholder="Python, React, AWS, SQL" />
                  <TextArea label="Soft skills" rows={3} value={f.soft} onChange={v => set("soft", v)} placeholder="Leadership, Communication" />
                </div>
              )}

              {step === 5 && (
                <div className="col">
                  <TextArea label="Certifications" value={f.certs} onChange={v => set("certs", v)} placeholder={"AWS Solutions Architect\nGoogle Analytics"} />
                  <TextArea label="Projects" value={f.projects} onChange={v => set("projects", v)} placeholder={"ResUAI – Python / Next.js\nSales dashboard – Power BI"} />
                  <div className="grid2">
                    <TextArea label="Languages" value={f.langs} onChange={v => set("langs", v)} placeholder={"English (fluent)\nHindi (native)"} />
                    <TextArea label="Awards" value={f.awards} onChange={v => set("awards", v)} placeholder={"Hackathon winner 2024\nDean’s list 2023"} />
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="col">
                  <Check id="genCL" checked={f.genCL} onChange={v => set("genCL", v)}>Also write a cover letter</Check>
                  {f.genCL && (
                    <>
                      <div className="grid2">
                        <Field label="Company" value={f.company} onChange={v => set("company", v)} placeholder="Amazon" />
                        <Select label="Tone" value={f.tone} onChange={v => set("tone", v)} options={TONES} />
                      </div>
                      <TextArea label="Job description" optional rows={6} value={f.jd} onChange={v => set("jd", v)}
                        placeholder="Paste the job posting here." hint="Without one, the letter will be more generic." />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ws-foot">
            <button className="btn btn-line" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft size={16} /> Back</button>
            {step < STEPS.length - 1
              ? <button className="btn btn-ink" onClick={() => setStep(s => s + 1)}>Next: {STEPS[step + 1].short} <ArrowRight size={16} /></button>
              : <button className="btn btn-blue" onClick={generate} disabled={loading}>{loading ? <><Spinner /> Writing…</> : "Generate resume"}</button>}
          </div>
        </section>

        {/* ── Canvas ───────────────────────────────────────────────────── */}
        <section className="ws-canvas" aria-label="Preview" aria-live="polite">
          <CanvasBar>
            <Segmented label="Document" value={view} onChange={setView}
              options={[
                { value: "draft" as const, label: "Live draft" },
                ...(result ? [{ value: "ai" as const, label: "AI version" }] : []),
                ...(result?.cover_letter ? [{ value: "letter" as const, label: "Cover letter" }] : []),
              ]} />
            {result && view !== "draft" && (
              <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {user && (saved
                  ? <span className="small" style={{ fontWeight: 700 }}>Saved to library</span>
                  : <button className="btn btn-quiet btn-sm" onClick={saveToAccount}><Bookmark size={14} /> Save</button>)}
                <DownloadGate attemptId={result.attempt_id} onDownload={fmt => downloadResume(result.attempt_id, fmt)} />
              </span>
            )}
          </CanvasBar>

          <div className="artboard">
            {view === "letter" && result?.cover_letter
              ? <article className="sheet sheet-letter" aria-label="Cover letter">{result.cover_letter}</article>
              : view === "ai" && result
                ? <ResumeText text={result.resume_text} />
                : <ResumeSheet blocks={blocks} />}
          </div>
          {loading && <Working>Writing your resume…</Working>}
        </section>
      </div>
    </AppShell>
  );
}
