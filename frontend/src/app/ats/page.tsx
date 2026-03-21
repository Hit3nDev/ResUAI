"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Navbar from "@/components/Navbar";
import { analyzeATS, extractText } from "@/lib/api";
import { Upload, Target, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "#00C896" : value >= 55 ? "#0EA5E9" : value >= 35 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#7A8BA8", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}/100</span>
      </div>
      <div className="progress-track">
        <div style={{ height: "100%", borderRadius: "100px", width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}80)`, transition: "width 0.7s ease" }} />
      </div>
    </div>
  );
}

function DropZone({ label, onFile, file }: { label: string; onFile: (f: File, text: string) => void; file: File | null }) {
  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    const tid = toast.loading("Extracting...");
    try {
      const data = await extractText(files[0]);
      onFile(files[0], data.text);
      toast.success(`${data.word_count} words`, { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    }
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt"] },
    multiple: false,
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`} style={{ padding: "28px 20px", textAlign: "center" }}>
      <input {...getInputProps()} />
      {file ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <CheckCircle size={24} color="#00C896" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E8EEF8" }}>{file.name}</span>
          <span style={{ fontSize: 12, color: "#3D5270" }}>Click to replace</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Upload size={22} color="#3D5270" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#7A8BA8" }}>{isDragActive ? "Drop here" : label}</span>
          <span style={{ fontSize: 12, color: "#3D5270" }}>PDF, DOCX, TXT</span>
        </div>
      )}
    </div>
  );
}

export default function ATSPage() {
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText]         = useState("");
  const [jdFile, setJdFile]         = useState<File | null>(null);
  const [inputMode, setInputMode]   = useState<"upload" | "paste">("upload");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);

  async function analyze() {
    const rt = resumeText || (resumeFile ? "(uploaded)" : "");
    const jd = jdText;
    if (!rt) { toast.error("Please provide your resume"); return; }
    if (!jd) { toast.error("Please provide the job description"); return; }
    if (!resumeText && !resumeFile) { toast.error("No resume text extracted"); return; }

    setLoading(true);
    const tid = toast.loading("Running ATS analysis...");
    try {
      const res = await analyzeATS(resumeText, jdText);
      setResult(res);
      const score = res.overall_score;
      const verdict = score >= 75 ? "Excellent" : score >= 55 ? "Good" : "Needs improvement";
      toast.success(`Score: ${score}/100 — ${verdict}`, { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setLoading(false);
    }
  }

  const verdictColor = result ? (result.overall_score >= 75 ? "#00C896" : result.overall_score >= 55 ? "#0EA5E9" : result.overall_score >= 35 ? "#F59E0B" : "#EF4444") : "#00C896";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-[1320px] mx-auto px-6 py-10">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="sec-label">ATS Analyzer</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", color: "#E8EEF8", marginBottom: 8 }}>
            ATS Compatibility Check
          </h1>
          <p style={{ fontSize: 14, color: "#7A8BA8" }}>Score your resume 0–100 against a job description. Close keyword gaps before applying.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8" style={{ marginBottom: 32 }}>
          {/* Resume input */}
          <div>
            <div className="sec-label">Your Resume</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, background: "#0C1525", borderRadius: 10, padding: 4, width: "fit-content" }}>
              {(["upload","paste"] as const).map(m => (
                <button key={m} onClick={() => setInputMode(m)} style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: inputMode === m ? "#162034" : "transparent", color: inputMode === m ? "#E8EEF8" : "#7A8BA8",
                }}>
                  {m === "upload" ? "Upload" : "Paste"}
                </button>
              ))}
            </div>
            {inputMode === "upload" ? (
              <DropZone label="Upload your resume" file={resumeFile}
                onFile={(f, t) => { setResumeFile(f); setResumeText(t); }} />
            ) : (
              <textarea className="field" rows={10} value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder={"JOHN DOE\njohn@email.com\n\nSUMMARY\n..."} style={{ resize: "vertical" }} />
            )}
          </div>

          {/* JD input */}
          <div>
            <div className="sec-label">Job Description</div>
            <textarea className="field" rows={14} value={jdText} onChange={e => setJdText(e.target.value)}
              placeholder="Paste the complete job description here..." style={{ resize: "vertical" }} />
            {jdText && <div style={{ fontSize: 12, color: "#3D5270", marginTop: 6 }}>{jdText.split(" ").length} words</div>}
          </div>
        </div>

        <button className="btn-primary" onClick={analyze} disabled={loading} style={{ padding: "13px 32px", fontSize: 15, display: "flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
          {loading ? <><div className="spinner" /> Analyzing...</> : <><Target size={16} /> Run ATS Analysis</>}
        </button>

        {/* Results */}
        {result && (
          <div className="animate-fade-up">
            <div className="sec-label" style={{ marginBottom: 24 }}>Analysis Results</div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Score hero */}
              <div className="card" style={{ padding: "32px 24px", textAlign: "center", background: `linear-gradient(135deg, ${verdictColor}08, transparent)`, borderColor: `${verdictColor}25` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3D5270", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Overall ATS Score</div>
                <div className="score-value" style={{ background: `linear-gradient(135deg, ${verdictColor}, #0EA5E9)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {result.overall_score}
                </div>
                <div style={{ fontSize: 14, color: "#7A8BA8", marginTop: 4, marginBottom: 16 }}>/100</div>
                <div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 20, background: `${verdictColor}18`, border: `1px solid ${verdictColor}30`, color: verdictColor, fontSize: 13, fontWeight: 700 }}>
                  {result.verdict}
                </div>
              </div>

              {/* Sub scores */}
              <div className="card" style={{ padding: "24px", gridColumn: "span 2" }}>
                <div className="sec-label" style={{ marginBottom: 16 }}>Score Breakdown</div>
                <ScoreBar label="Keyword Match"    value={result.keyword_score} />
                <ScoreBar label="Format Score"     value={result.format_score} />
                <ScoreBar label="Relevance Score"  value={result.relevance_score} />
              </div>
            </div>

            {/* Section scores */}
            {result.section_scores && (
              <div className="card" style={{ padding: "24px", marginBottom: 20 }}>
                <div className="sec-label" style={{ marginBottom: 16 }}>Section Scores</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {Object.entries(result.section_scores).map(([sec, val]: any) => {
                    const c = val >= 75 ? "#00C896" : val >= 55 ? "#0EA5E9" : val >= 35 ? "#F59E0B" : "#EF4444";
                    return (
                      <div key={sec} className="card-static" style={{ padding: "14px", textAlign: "center" }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: c, letterSpacing: "-0.04em" }}>{val}</div>
                        <div style={{ fontSize: 11, color: "#3D5270", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>{sec}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Keywords */}
              <div className="card" style={{ padding: "24px" }}>
                <div className="sec-label" style={{ marginBottom: 14 }}>Matched Keywords</div>
                {result.matched_keywords?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.matched_keywords.map((k: string) => (
                      <span key={k} className="badge badge-green" style={{ fontSize: 11 }}>
                        <CheckCircle size={10} /> {k}
                      </span>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 13, color: "#3D5270" }}>No keywords matched yet.</div>}

                <div className="sec-label" style={{ marginTop: 20, marginBottom: 14 }}>Strengths</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.strengths?.map((s: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#7A8BA8", padding: "8px 10px", background: "rgba(0,200,150,0.05)", borderRadius: 8, borderLeft: "2px solid rgba(0,200,150,0.3)" }}>
                      <CheckCircle size={13} color="#00C896" style={{ flexShrink: 0, marginTop: 1 }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing + improvements */}
              <div className="card" style={{ padding: "24px" }}>
                <div className="sec-label" style={{ marginBottom: 14 }}>Missing Keywords</div>
                {result.missing_keywords?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.missing_keywords.map((k: string) => (
                      <span key={k} className="badge badge-red" style={{ fontSize: 11 }}>
                        <XCircle size={10} /> {k}
                      </span>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 13, color: "#00C896" }}>No major missing keywords!</div>}

                <div className="sec-label" style={{ marginTop: 20, marginBottom: 14 }}>Improvements</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.improvements?.map((tip: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#7A8BA8", padding: "8px 10px", background: "rgba(14,165,233,0.05)", borderRadius: 8, borderLeft: "2px solid rgba(14,165,233,0.3)" }}>
                      <TrendingUp size={13} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span><b style={{ color: "#E8EEF8" }}>{i + 1}.</b> {tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
