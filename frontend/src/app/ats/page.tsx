"use client";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Gauge, Upload } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/AppShell";
import ATSReport from "@/components/ATSReport";
import { ResumeText, markKeywords } from "@/components/ResumeSheet";
import { CanvasBar, EmptyCanvas, Segmented, Spinner, TextArea, ViewSwitch, Working } from "@/components/ui";
import { analyzeATS, ATSResult, extractText, wordCount } from "@/lib/api";

function DropBox({ label, file, onText, compact }: { label: string; file: File | null; onText: (f: File, text: string) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    const tid = toast.loading(`Reading ${f.name}…`);
    try {
      const d = await extractText(f);
      if (!d.text.trim()) throw new Error("No text found in that file. Scanned PDFs need OCR first.");
      onText(f, d.text);
      toast.success(`Read ${d.word_count} words.`, { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Couldn’t read that file", { id: tid });
    } finally { setBusy(false); }
  }, [onText]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, maxSize: 10 * 1024 * 1024,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt"] },
    onDropRejected: () => toast.error("Please upload a PDF, DOCX or TXT file under 10 MB."),
  });
  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`} style={compact ? { padding: "14px" } : undefined}>
      <input {...getInputProps()} aria-label={label} />
      {busy ? <Spinner /> : file ? (
        <><FileText size={compact ? 18 : 24} /><b style={{ fontSize: 14 }}>{file.name}</b><span className="small">click to replace</span></>
      ) : (
        <><Upload size={compact ? 18 : 24} /><b style={{ fontSize: compact ? 14 : 16 }}>{isDragActive ? "Drop it here" : label}</b><span className="small">PDF, DOCX or TXT</span></>
      )}
    </div>
  );
}

export default function ATSPage() {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ATSResult | null>(null);
  const [view, setView] = useState<"report" | "context">("report");
  const [mview, setMview] = useState<"edit" | "preview">("edit");

  async function analyze() {
    if (!resumeText.trim()) { toast.error(mode === "upload" ? "Upload your resume first." : "Paste your resume first."); return; }
    if (!jdText.trim())     { toast.error("Add the job description to score against."); return; }
    setLoading(true);
    const tid = toast.loading("Reading the resume against the ad…");
    try {
      const res = await analyzeATS(resumeText, jdText);
      setResult(res); setView("report"); setMview("preview");
      toast.success(`Score: ${Math.round(res.overall_score)}/100`, { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Analysis failed", { id: tid });
    } finally { setLoading(false); }
  }

  const mark = useMemo(() => markKeywords(result?.matched_keywords ?? []), [result]);

  return (
    <AppShell title="Score" sub="Resume vs. job ad"
      actions={
        <button className="btn btn-blue" onClick={analyze} disabled={loading}>
          {loading ? <><Spinner /> Analysing…</> : <><Gauge size={16} /> Run ATS check</>}
        </button>
      }>
      <ViewSwitch value={mview} onChange={setMview} a="Input" b="Report" />

      <div className="ws" data-view={mview}>
        <section className="ws-form" aria-label="Inputs">
          <div className="ws-scroll">
            <h2 className="h-step">Resume</h2>
            <p className="small" style={{ margin: "0 0 16px" }}>The one you’d actually send.</p>
            <div style={{ marginBottom: 14 }}>
              <Segmented label="Resume source" value={mode} onChange={setMode}
                options={[{ value: "upload", label: "Upload" }, { value: "paste", label: "Paste" }]} />
            </div>
            {mode === "upload"
              ? <DropBox label="Drop your resume here" file={resumeFile} onText={(f, t) => { setResumeFile(f); setResumeText(t); setResult(null); }} />
              : <TextArea label="Resume text" rows={9} value={resumeText} onChange={v => { setResumeText(v); setResult(null); }} placeholder={"JOHN DOE\njohn@email.com\n\nSUMMARY\n…"}
                  hint={resumeText ? `${wordCount(resumeText)} words` : undefined} />}

            <h2 className="h-step" style={{ marginTop: 34 }}>Job ad</h2>
            <p className="small" style={{ margin: "0 0 16px" }}>Paste the full posting. More detail means a sharper score.</p>
            <TextArea label="Job description" rows={9} value={jdText} onChange={v => { setJdText(v); setResult(null); }}
              placeholder="Paste the complete job posting here." hint={jdText ? `${wordCount(jdText)} words` : undefined} />
            <div style={{ marginTop: 12 }}>
              <DropBox compact label="…or upload the job ad as a file" file={jdFile} onText={(f, t) => { setJdFile(f); setJdText(t); setResult(null); }} />
            </div>
          </div>
          <div className="ws-foot">
            <button className="btn btn-blue btn-block" onClick={analyze} disabled={loading}>
              {loading ? <><Spinner /> Analysing…</> : <><Gauge size={16} /> Run ATS check</>}
            </button>
          </div>
        </section>

        <section className="ws-canvas" aria-label="Report" aria-live="polite">
          <CanvasBar>
            {result ? (
              <Segmented label="View" value={view} onChange={setView}
                options={[{ value: "report" as const, label: "Report" }, { value: "context" as const, label: "Keywords in context" }]} />
            ) : (
              <>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{resumeText.trim() ? "Your resume" : "Report"}</span>
                <span className="small">{resumeText.trim() ? `${wordCount(resumeText)} words` : "Run a check to see results"}</span>
              </>
            )}
            {result && view === "context" && <span className="small"><mark className="mk">highlighted</mark> = found in the job ad</span>}
          </CanvasBar>

          <div className="artboard">
            {result && view === "report" ? <ATSReport r={result} />
              : result ? <ResumeText text={resumeText} mark={mark} />
              : resumeText.trim() ? <ResumeText text={resumeText} />
              : <EmptyCanvas title="No report yet">Add a resume and a job ad, then run the check. You’ll get a score, the keywords you’re missing, and a short list of what to fix.</EmptyCanvas>}
          </div>
          {loading && <Working>Scoring against the ad…</Working>}
        </section>
      </div>
    </AppShell>
  );
}
