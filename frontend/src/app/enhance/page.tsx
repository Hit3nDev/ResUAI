"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Navbar from "@/components/Navbar";
import { enhanceText, enhanceFile, downloadEnhanced, extractText } from "@/lib/api";
import { Upload, FileText, FileDown, Zap, ArrowRight, CheckCircle } from "lucide-react";
import DownloadGate from "@/components/DownloadGate";
import toast from "react-hot-toast";

const focusOptions = ["Stronger action verbs","Quantify achievements","Improve summary","ATS keyword optimization","Clarity & conciseness","Skills section"];
const tones = ["Professional","Conversational","Confident & Bold","Friendly"];

export default function EnhancePage() {
  const [mode, setMode]               = useState<"text" | "file">("file");
  const [resumeText, setResumeText]   = useState("");
  const [uploadedFile, setFile]       = useState<File | null>(null);
  const [extractedText, setExtracted] = useState("");
  const [extracting, setExtracting]   = useState(false);

  const [jobTitle, setJobTitle]       = useState("");
  const [jobDesc, setJobDesc]         = useState("");
  const [focus, setFocus]             = useState<string[]>(["Stronger action verbs","Quantify achievements","Improve summary"]);

  const [genCL, setGenCL]             = useState(false);
  const [company, setCompany]         = useState("");
  const [tone, setTone]               = useState("Professional");

  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<any>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setExtracting(true);
    const tid = toast.loading(`Extracting text from ${f.name}...`);
    try {
      const data = await extractText(f);
      setExtracted(data.text);
      toast.success(`Extracted ${data.word_count} words`, { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setExtracting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt"] },
    multiple: false,
  });

  const toggleFocus = (f: string) => setFocus(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);

  async function enhance() {
    const textToEnhance = mode === "file" ? extractedText : resumeText;
    if (!textToEnhance.trim()) { toast.error("Please upload or paste your resume"); return; }
    setLoading(true);
    const tid = toast.loading("Enhancing your resume...");
    try {
      const res = await enhanceText({
        resume_text: textToEnhance, job_title: jobTitle,
        job_description: jobDesc, enhance_focus: focus,
        generate_cover_letter: genCL, company_name: company, cover_tone: tone,
      });
      setResult(res);
      const delta = res.enhanced_word_count - res.original_word_count;
      toast.success(`Enhanced! ${res.enhanced_word_count} words (${delta >= 0 ? "+" : ""}${delta})`, { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
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
          <div className="sec-label">AI Enhancer</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8", marginBottom: 8 }}>
            Enhance Existing Resume
          </h1>
          <p style={{ fontSize: 14, color: "#7A8BA8" }}>Upload or paste your resume — AI rewrites it with stronger language and quantified achievements.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
          {/* Left */}
          <div>
            {/* Mode toggle */}
            <div style={{ display: "flex", background: "#0C1525", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
              {(["file","text"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer", transition: "all 0.2s",
                  background: mode === m ? "#162034" : "transparent",
                  color: mode === m ? "#E8EEF8" : "#7A8BA8",
                }}>
                  {m === "file" ? "Upload File" : "Paste Text"}
                </button>
              ))}
            </div>

            {/* Upload / Paste */}
            {mode === "file" ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}
                style={{ padding: "40px 24px", textAlign: "center", marginBottom: 20 }}>
                <input {...getInputProps()} />
                {extracting ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div className="spinner" />
                    <span style={{ fontSize: 14, color: "#7A8BA8" }}>Extracting text...</span>
                  </div>
                ) : uploadedFile ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={28} color="#00C896" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#E8EEF8" }}>{uploadedFile.name}</span>
                    <span style={{ fontSize: 13, color: "#7A8BA8" }}>{extractedText.split(" ").length} words extracted · Click to replace</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Upload size={28} color="#3D5270" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#E8EEF8" }}>
                      {isDragActive ? "Drop your resume here" : "Drag & drop your resume"}
                    </span>
                    <span style={{ fontSize: 13, color: "#3D5270" }}>PDF, DOCX, or TXT · Click to browse</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">Resume Text</label>
                <textarea className="field" rows={10} value={resumeText} onChange={e => setResumeText(e.target.value)}
                  placeholder={"JOHN DOE\njohn@email.com | +1 555-0100\n\nSUMMARY\nExperienced software engineer..."} style={{ resize: "vertical" }} />
                {resumeText && <div style={{ fontSize: 12, color: "#3D5270", marginTop: 6 }}>{resumeText.split(" ").length} words</div>}
              </div>
            )}

            {/* Enhancement options */}
            <div className="card-static" style={{ padding: "18px", marginBottom: 16 }}>
              <div className="sec-label" style={{ marginBottom: 12 }}>Enhancement Options</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="field-label">Target Job Title</label>
                  <input className="field" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Senior Data Scientist" />
                </div>
                <div></div>
                <div style={{ gridColumn: "span 2" }}>
                  <label className="field-label">Job Description (optional)</label>
                  <textarea className="field" rows={4} value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste job posting for targeted enhancement..." style={{ resize: "vertical" }} />
                </div>
              </div>

              <label className="field-label" style={{ marginBottom: 10 }}>Focus Areas</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {focusOptions.map(f => (
                  <button key={f} onClick={() => toggleFocus(f)} style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    background: focus.includes(f) ? "rgba(0,200,150,0.12)" : "#0C1525",
                    color: focus.includes(f) ? "#00C896" : "#7A8BA8",
                    border: focus.includes(f) ? "1px solid rgba(0,200,150,0.25)" : "1px solid #162034",
                  }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover letter */}
            <div className="card-static" style={{ padding: "18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <input type="checkbox" id="genCL" checked={genCL} onChange={e => setGenCL(e.target.checked)} style={{ accentColor: "#00C896", width: 16, height: 16 }} />
                <label htmlFor="genCL" style={{ fontSize: 14, color: "#7A8BA8", cursor: "pointer" }}>Also generate a Cover Letter</label>
              </div>
              {genCL && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="field-label">Company Name</label>
                    <input className="field" value={company} onChange={e => setCompany(e.target.value)} placeholder="Microsoft" />
                  </div>
                  <div>
                    <label className="field-label">Tone</label>
                    <select className="field" value={tone} onChange={e => setTone(e.target.value)}>
                      {tones.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={enhance} disabled={loading} style={{ width: "100%", padding: "14px", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><div className="spinner" /> Enhancing...</> : <><Zap size={16} /> Enhance Resume</>}
            </button>
          </div>

          {/* Right — results */}
          <div>
            <div style={{ position: "sticky", top: 80 }}>
              {result ? (
                <div className="animate-fade-up">
                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Original Words", val: result.original_word_count },
                      { label: "Enhanced Words", val: result.enhanced_word_count, highlight: true },
                    ].map(s => (
                      <div key={s.label} className="card-static" style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.highlight ? "#00C896" : "#E8EEF8", letterSpacing: "-0.03em" }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: "#3D5270", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Downloads — auth-gated */}
                  <div className="card-static" style={{ padding: "16px", marginBottom: 12 }}>
                    <div className="sec-label" style={{ marginBottom: 10 }}>Download Enhanced</div>
                    <DownloadGate
                      attemptId={result.attempt_id}
                      onDownload={(fmt) => downloadEnhanced(result.attempt_id, fmt)}
                    />
                  </div>

                  {/* Enhanced preview */}
                  <div className="card-static">
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #162034" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#00C896", textTransform: "uppercase", letterSpacing: "0.08em" }}>Enhanced Resume</span>
                    </div>
                    <div className="resume-view" style={{ border: "none", borderRadius: "0 0 14px 14px", maxHeight: 340 }}>
                      {result.enhanced_text}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Zap size={22} color="#00C896" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEF8", marginBottom: 8 }}>Enhanced version appears here</div>
                  <div style={{ fontSize: 13, color: "#3D5270" }}>Upload your resume and click Enhance Resume.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
