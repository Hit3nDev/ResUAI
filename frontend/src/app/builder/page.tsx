"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { createResume, downloadResume, saveResumeToAccount } from "@/lib/api";
import { Plus, Trash2, FileDown, ChevronDown, ChevronUp, CheckCircle, BookmarkPlus } from "lucide-react";
import DownloadGate from "@/components/DownloadGate";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

const levels = ["Fresher / Entry Level", "1–3 Years", "3–7 Years", "7+ Years / Senior"];
const tones  = ["Professional", "Conversational", "Confident & Bold", "Friendly"];

interface Exp  { company: string; title: string; duration: string; location: string; bullets: string }
interface Edu  { degree: string; school: string; year: string; gpa: string }

function Section({ title, open, toggle, children }: any) {
  return (
    // FIX 5: increased marginBottom from 12 → 16, better vertical rhythm
    <div className="card-static" style={{ marginBottom: 16, borderRadius: 14 }}>
      <button
        onClick={toggle}
        style={{
          width: "100%", padding: "18px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", cursor: "pointer", color: "#E8EEF8",
          // Subtle hover bg
          transition: "background 0.15s ease",
          borderRadius: open ? "14px 14px 0 0" : 14,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "#E8EEF8" }}>{title}</span>
        {open
          ? <ChevronUp size={15} color="#00C896" style={{ transition: "transform 0.2s" }} />
          : <ChevronDown size={15} color="#7A8BA8" style={{ transition: "transform 0.2s" }} />
        }
      </button>
      {open && (
        <div style={{
          // FIX 5: proper internal padding — 8px top gap, 24px sides/bottom
          padding: "8px 22px 26px",
          borderTop: "1px solid #162034",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FieldGroup({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) {
  // FIX 5: gap from 12 → 16, marginBottom on group
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 16,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    // FIX 5: label marginBottom 8px, wrapper marginBottom 0 (FieldGroup handles spacing)
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label className="field-label" style={{ marginBottom: 8, fontSize: 11 }}>{label}</label>
      {type === "textarea"
        ? (
          <textarea
            className="field"
            rows={3}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <input
            className="field"
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )
      }
    </div>
  );
}

export default function BuilderPage() {
  // Personal
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [loc, setLoc]       = useState("");
  const [linkedin, setLi]   = useState("");
  const [site, setSite]     = useState("");

  // Role
  const [role, setRole]     = useState("");
  const [level, setLevel]   = useState(levels[0]);
  const [summary, setSummary] = useState("");

  // Experience
  const [exps, setExps] = useState<Exp[]>([{ company: "", title: "", duration: "", location: "", bullets: "" }]);

  // Education
  const [edus, setEdus] = useState<Edu[]>([{ degree: "", school: "", year: "", gpa: "" }]);

  // Skills
  const [techSkills, setTech] = useState("");
  const [softSkills, setSoft] = useState("");

  // Extra
  const [certs, setCerts]   = useState("");
  const [projects, setProj] = useState("");
  const [langs, setLangs]   = useState("");
  const [awards, setAwards] = useState("");

  // Cover letter
  const [genCL, setGenCL]     = useState(false);
  const [company, setCompany] = useState("");
  const [tone, setTone]       = useState(tones[0]);
  const [jd, setJd]           = useState("");

  // UI
  const [open, setOpen]     = useState<Record<string, boolean>>({ personal: true, role: true, exp: true, edu: false, skills: false, extra: false, cl: false });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ resume_text: string; cover_letter?: string; attempt_id: number; word_count: number } | null>(null);
  const [saved,   setSaved]   = useState(false);
  const { user } = useAuth();

  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const addExp = () => setExps(p => [...p, { company: "", title: "", duration: "", location: "", bullets: "" }]);
  const remExp = (i: number) => setExps(p => p.filter((_, j) => j !== i));
  const setExp = (i: number, key: keyof Exp, v: string) => setExps(p => p.map((e, j) => j === i ? { ...e, [key]: v } : e));

  const addEdu = () => setEdus(p => [...p, { degree: "", school: "", year: "", gpa: "" }]);
  const remEdu = (i: number) => setEdus(p => p.filter((_, j) => j !== i));
  const setEdu = (i: number, key: keyof Edu, v: string) => setEdus(p => p.map((e, j) => j === i ? { ...e, [key]: v } : e));

  async function generate() {
    if (!name.trim() || !role.trim()) { toast.error("Name and Target Role are required"); return; }
    setLoading(true);
    const toastId = toast.loading("Generating your resume...");
    try {
      const data = {
        personal: { name, email, phone, location: loc, linkedin, website: site },
        target_role: role, experience_level: level, summary_hint: summary,
        experiences: exps.filter(e => e.company && e.title).map(e => ({
          company: e.company, title: e.title, duration: e.duration, location: e.location,
          bullets: e.bullets.split("\n").filter(Boolean),
        })),
        education: edus.filter(e => e.degree && e.school).map(e => ({
          degree: e.degree, school: e.school, year: e.year, gpa: e.gpa,
        })),
        skills: {
          technical: techSkills.split(",").map(s => s.trim()).filter(Boolean),
          soft: softSkills.split(",").map(s => s.trim()).filter(Boolean),
        },
        certifications: certs.split("\n").filter(Boolean),
        projects: projects.split("\n").filter(Boolean),
        languages: langs.split("\n").filter(Boolean),
        achievements: awards.split("\n").filter(Boolean),
        generate_cover_letter: genCL,
        company_name: company, cover_tone: tone, job_description: jd,
      };
      const res = await createResume(data);
      setResult(res);
      toast.success(`Resume created — ${res.word_count} words`, { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Generation failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-[1320px] mx-auto px-6 py-10">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="sec-label">Resume Builder</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8", marginBottom: 8 }}>
            Create Resume from Scratch
          </h1>
          <p style={{ fontSize: 14, color: "#7A8BA8" }}>Fill in your details. AI generates a polished, ATS-optimized resume in seconds.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-8">
          {/* Left — form */}
          <div>
            {/* Status banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00C896", boxShadow: "0 0 6px #00C896" }} />
              <span style={{ fontSize: 13, color: "#00C896", fontWeight: 500 }}>AI Ready — Groq Llama 3.3 70B connected</span>
            </div>

            {/* Personal Info */}
            <Section title="Personal Information" open={open.personal} toggle={() => toggle("personal")}>
              <FieldGroup>
                <Field label="Full Name *"    value={name}  onChange={setName}  placeholder="Alex Johnson" />
                <Field label="Email *"        value={email} onChange={setEmail} placeholder="alex@email.com" type="email" />
                <Field label="Phone"          value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
              </FieldGroup>
              <FieldGroup cols={3} >
                <Field label="Location"     value={loc}     onChange={setLoc}  placeholder="New Delhi, India" />
                <Field label="LinkedIn URL" value={linkedin} onChange={setLi}  placeholder="linkedin.com/in/alex" />
                <Field label="Portfolio / GitHub" value={site} onChange={setSite} placeholder="github.com/alex" />
              </FieldGroup>
            </Section>

            {/* Target Role */}
            <Section title="Target Role" open={open.role} toggle={() => toggle("role")}>
              <FieldGroup cols={2}>
                <Field label="Target Job Title *" value={role} onChange={setRole} placeholder="Software Engineer" />
                <div>
                  <label className="field-label">Experience Level</label>
                  <select className="field" value={level} onChange={e => setLevel(e.target.value)}>
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </FieldGroup>
              <Field label="Professional Summary Hint (optional — AI writes one if blank)" value={summary} onChange={setSummary} placeholder="Brief background overview..." type="textarea" />
            </Section>

            {/* Work Experience */}
            <Section title={`Work Experience (${exps.filter(e => e.company).length} added)`} open={open.exp} toggle={() => toggle("exp")}>
              {exps.map((exp, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #162034",
                  borderRadius: 12,
                  padding: "18px",
                  marginBottom: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#3D5270", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Position {i + 1}{i === 0 ? " — Most Recent" : ""}
                    </span>
                    {exps.length > 1 && (
                      <button onClick={() => remExp(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3D5270", padding: 4, transition: "color 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#F87171"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3D5270"; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <FieldGroup cols={2}>
                    <Field label="Company"   value={exp.company}  onChange={(v: string) => setExp(i, "company", v)}  placeholder="Google" />
                    <Field label="Job Title" value={exp.title}    onChange={(v: string) => setExp(i, "title", v)}    placeholder="Software Engineer" />
                    <Field label="Duration"  value={exp.duration} onChange={(v: string) => setExp(i, "duration", v)} placeholder="Jan 2022 – Present" />
                    <Field label="Location"  value={exp.location} onChange={(v: string) => setExp(i, "location", v)} placeholder="Bangalore" />
                  </FieldGroup>
                  {/* FIX 5: Explicit label margin for long-label fields */}
                  <div>
                    <label className="field-label" style={{ marginBottom: 8, fontSize: 11 }}>Responsibilities &amp; Achievements (one per line)</label>
                    <textarea className="field" rows={3} value={exp.bullets} onChange={e => setExp(i, "bullets", e.target.value)}
                      placeholder={"Built REST APIs serving 10,000+ daily users\nReduced query time 40% via indexing"} style={{ resize: "vertical", lineHeight: 1.6 }} />
                  </div>
                </div>
              ))}
              {exps.length < 5 && (
                <button onClick={addExp} className="btn-ghost" style={{ padding: "9px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Plus size={14} /> Add Position
                </button>
              )}
            </Section>

            {/* Education */}
            <Section title={`Education (${edus.filter(e => e.degree).length} added)`} open={open.edu} toggle={() => toggle("edu")}>
              {edus.map((edu, i) => (
                <div key={i} className="card-static" style={{ padding: "16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Education {i + 1}
                    </span>
                    {edus.length > 1 && (
                      <button onClick={() => remEdu(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A8BA8" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <FieldGroup cols={2}>
                    <Field label="Degree"       value={edu.degree} onChange={(v: string) => setEdu(i, "degree", v)} placeholder="B.Tech Computer Science" />
                    <Field label="Institution"  value={edu.school} onChange={(v: string) => setEdu(i, "school", v)} placeholder="IIT Delhi" />
                    <Field label="Year"         value={edu.year}   onChange={(v: string) => setEdu(i, "year", v)}   placeholder="2023" />
                    <Field label="GPA / Grade"  value={edu.gpa}    onChange={(v: string) => setEdu(i, "gpa", v)}    placeholder="8.7 / 10" />
                  </FieldGroup>
                </div>
              ))}
              {edus.length < 4 && (
                <button onClick={addEdu} className="btn-ghost" style={{ padding: "9px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Add Education
                </button>
              )}
            </Section>

            {/* Skills */}
            <Section title="Skills" open={open.skills} toggle={() => toggle("skills")}>
              <FieldGroup cols={2}>
                <Field label="Technical Skills (comma-separated)" value={techSkills} onChange={setTech} placeholder="Python, React, AWS, SQL" type="textarea" />
                <Field label="Soft Skills (comma-separated)"      value={softSkills} onChange={setSoft} placeholder="Leadership, Communication" type="textarea" />
              </FieldGroup>
            </Section>

            {/* Additional */}
            <Section title="Additional Sections" open={open.extra} toggle={() => toggle("extra")}>
              <FieldGroup cols={2}>
                <Field label="Certifications (one per line)"   value={certs}    onChange={setCerts}   placeholder={"AWS Solutions Architect\nGoogle Analytics"} type="textarea" />
                <Field label="Languages (one per line)"        value={langs}    onChange={setLangs}   placeholder={"English (Fluent)\nHindi (Native)"}          type="textarea" />
                <Field label="Projects (one per line)"         value={projects} onChange={setProj}    placeholder={"ResUAI – Python/Next.js\nDashboard – BI"} type="textarea" />
                <Field label="Awards / Achievements"           value={awards}   onChange={setAwards}  placeholder={"Hackathon Winner 2024\nDean's List 2023"}   type="textarea" />
              </FieldGroup>
            </Section>

            {/* Cover Letter */}
            <Section title="Cover Letter (Optional)" open={open.cl} toggle={() => toggle("cl")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <input type="checkbox" id="genCL" checked={genCL} onChange={e => setGenCL(e.target.checked)} style={{ accentColor: "#00C896", width: 16, height: 16 }} />
                <label htmlFor="genCL" style={{ fontSize: 14, color: "#7A8BA8", cursor: "pointer" }}>Also generate a Cover Letter</label>
              </div>
              {genCL && (
                <FieldGroup cols={2}>
                  <Field label="Company Name" value={company} onChange={setCompany} placeholder="Amazon" />
                  <div>
                    <label className="field-label">Tone</label>
                    <select className="field" value={tone} onChange={e => setTone(e.target.value)}>
                      {tones.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <Field label="Job Description (optional)" value={jd} onChange={setJd} placeholder="Paste full job posting here..." type="textarea" />
                  </div>
                </FieldGroup>
              )}
            </Section>

            {/* Generate button */}
            <button className="btn-primary" onClick={generate} disabled={loading} style={{ width: "100%", padding: "14px", fontSize: 15, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><div className="spinner" />  Generating...</> : "Generate Resume"}
            </button>
          </div>

          {/* Right — output panel */}
          <div>
            <div style={{ position: "sticky", top: 80 }}>
              {result ? (
                <div className="animate-fade-up">
                  {/* Success header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, marginBottom: 16 }}>
                    <CheckCircle size={15} color="#00C896" />
                    <span style={{ fontSize: 13, color: "#00C896", fontWeight: 600 }}>Resume generated — {result.word_count} words</span>
                  </div>

                  {/* Save to account CTA — shown to logged-in users */}
                  {user && !saved && (
                    <button
                      onClick={async () => {
                        try {
                          await saveResumeToAccount(result.attempt_id, `${name || "My"} Resume`, result.resume_text);
                          setSaved(true);
                          toast.success("Resume saved to your account!");
                        } catch (e: any) {
                          toast.error(e.message || "Save failed");
                        }
                      }}
                      style={{
                        width: "100%", marginBottom: 12,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "10px", fontSize: 13, fontWeight: 600,
                        background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)",
                        borderRadius: 10, cursor: "pointer", color: "#00C896",
                        fontFamily: "inherit", transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.14)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.08)"; }}
                    >
                      <BookmarkPlus size={14} /> Save to My Account
                    </button>
                  )}
                  {user && saved && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px", marginBottom: 12, background: "rgba(0,200,150,0.05)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: 10, fontSize: 13, color: "#00C896" }}>
                      <CheckCircle size={14} /> Saved to your account
                    </div>
                  )}
                  {/* Upsell for logged-out users */}
                  {!user && (
                    <div style={{ marginBottom: 12, padding: "12px 14px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 10, fontSize: 13 }}>
                      <div style={{ color: "#7A8BA8", marginBottom: 6 }}>
                        <span style={{ color: "#38BDF8", fontWeight: 600 }}>Pro tip:</span> Create a free account to save, re-download, and edit your resumes anytime.
                      </div>
                      <Link href="/signup">
                        <button style={{ fontSize: 12, padding: "6px 14px", background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 8, cursor: "pointer", color: "#38BDF8", fontWeight: 600, fontFamily: "inherit" }}>
                          Sign up free →
                        </button>
                      </Link>
                    </div>
                  )}

                  {/* Download buttons → auth-gated */}
                  <div className="card-static" style={{ padding: "18px", marginBottom: 12 }}>
                    <div className="sec-label" style={{ marginBottom: 12 }}>Download Resume</div>
                    <DownloadGate
                      attemptId={result.attempt_id}
                      onDownload={(fmt) => downloadResume(result.attempt_id, fmt)}
                    />
                  </div>

                  {/* Preview */}
                  <div className="card-static">
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #162034", display: "flex", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", marginTop: 2 }} />
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", marginTop: 2 }} />
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", marginTop: 2 }} />
                      <span style={{ fontSize: 11, color: "#3D5270", marginLeft: 8 }}>Resume Preview</span>
                    </div>
                    <div className="resume-view" style={{ borderRadius: "0 0 14px 14px", border: "none", margin: 0 }}>
                      {result.resume_text}
                    </div>
                  </div>

                  {/* Cover letter */}
                  {result.cover_letter && (
                    <div className="card-static" style={{ marginTop: 12 }}>
                      <div style={{ padding: "14px 16px", borderBottom: "1px solid #162034" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Cover Letter</span>
                      </div>
                      <div className="resume-view" style={{ borderRadius: "0 0 14px 14px", border: "none", maxHeight: 300 }}>
                        {result.cover_letter}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <FileDown size={22} color="#00C896" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEF8", marginBottom: 8 }}>Your resume appears here</div>
                  <div style={{ fontSize: 13, color: "#3D5270", lineHeight: 1.65 }}>Fill in the form and click Generate Resume. Download as DOCX or PDF instantly.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
