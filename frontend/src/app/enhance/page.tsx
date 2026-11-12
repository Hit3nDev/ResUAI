"use client";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Highlighter, Upload } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/AppShell";
import DownloadGate from "@/components/DownloadGate";
import { DiffSheet, ResumeText } from "@/components/ResumeSheet";
import { CanvasBar, Check, EmptyCanvas, Field, Segmented, Select, Spinner, TextArea, ViewSwitch, Working } from "@/components/ui";
import { downloadEnhanced, enhanceText, EnhanceResult, extractText, wordCount } from "@/lib/api";
import { diffText } from "@/lib/diff";

const FOCUS = ["Stronger action verbs", "Quantify achievements", "Improve summary", "ATS keyword optimization", "Clarity & conciseness", "Skills section"];
const TONES = ["Professional", "Conversational", "Confident & Bold", "Friendly"];

type View = "changes" | "clean" | "original" | "letter";

export default function EnhancePage() {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [focus, setFocus] = useState<string[]>(FOCUS.slice(0, 3));
  const [genCL, setGenCL] = useState(false);
  const [company, setCompany] = useState("");
  const [tone, setTone] = useState(TONES[0]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [original, setOriginal] = useState("");
  const [view, setView] = useState<View>("changes");
  const [mview, setMview] = useState<"edit" | "preview">("edit");

  const source = mode === "file" ? extracted : pasted;

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f); setExtracted(""); setExtracting(true);
    const tid = toast.loading(`Reading ${f.name}…`);
    try {
      const data = await extractText(f);
      if (!data.text.trim()) throw new Error("No text found in that file. Scanned PDFs need OCR first.");
      setExtracted(data.text); setResult(null);
      toast.success(`Read ${data.word_count} words.`, { id: tid });
    } catch (e: any) {
      setFile(null);
      toast.error(e.message || "Couldn’t read that file", { id: tid });
    } finally { setExtracting(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, maxSize: 10 * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    onDropRejected: r => toast.error(r[0]?.errors[0]?.code === "file-too-large" ? "That file is over 10 MB." : "Please upload a PDF, DOCX or TXT file."),
  });

  const toggleFocus = (x: string) => setFocus(p => (p.includes(x) ? p.filter(y => y !== x) : [...p, x]));

  async function enhance() {
    if (!source.trim()) { toast.error(mode === "file" ? "Upload your resume first." : "Paste your resume first."); return; }
    if (genCL && !jobDesc.trim()) { toast.error("A cover letter needs a job description. Add one below."); return; }
    setLoading(true);
    const tid = toast.loading("Editing your resume…");
    try {
      const res = await enhanceText({
        resume_text: source, job_title: jobTitle, job_description: jobDesc, enhance_focus: focus,
        generate_cover_letter: genCL, company_name: company, cover_tone: tone,
      });
      setResult(res); setOriginal(source); setView("changes"); setMview("preview");
      const d = res.enhanced_word_count - res.original_word_count;
      toast.success(`Done. ${res.enhanced_word_count} words (${d >= 0 ? "+" : "−"}${Math.abs(d)}).`, { id: tid });
      if (genCL && !res.cover_letter) toast.error("The resume was enhanced, but the cover letter wasn’t written.", { duration: 6000 });
    } catch (e: any) {
      toast.error(e.message || "Enhancement failed", { id: tid });
    } finally { setLoading(false); }
  }

  const diff = useMemo(() => (result ? diffText(original, result.enhanced_text) : null), [result, original]);
  const delta = result ? result.enhanced_word_count - result.original_word_count : 0;

  return (
    <AppShell title="Enhance" sub={file && mode === "file" ? file.name : undefined}
      actions={
        <button className="btn btn-blue" onClick={enhance} disabled={loading || extracting}>
          {loading ? <><Spinner /> Editing…</> : <><Highlighter size={16} /> Enhance resume</>}
        </button>
      }>
      <ViewSwitch value={mview} onChange={setMview} a="Input" b="Result" />

      <div className="ws" data-view={mview}>
        {/* ── Inputs ───────────────────────────────────────────────────── */}
        <section className="ws-form" aria-label="Inputs">
          <div className="ws-scroll">
            <h2 className="h-step">Your resume</h2>
            <p className="small" style={{ margin: "0 0 18px" }}>Upload it or paste it. The wording gets rewritten; your facts don’t.</p>

            <div style={{ marginBottom: 14 }}>
              <Segmented label="Resume source" value={mode} onChange={setMode}
                options={[{ value: "file", label: "Upload file" }, { value: "text", label: "Paste text" }]} />
            </div>

            {mode === "file" ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}>
                <input {...getInputProps()} aria-label="Upload resume" />
                {extracting ? (
                  <><Spinner /><span className="small">Reading file…</span></>
                ) : file && extracted ? (
                  <><FileText size={24} /><b>{file.name}</b><span className="small">{wordCount(extracted)} words read · click to replace</span></>
                ) : (
                  <><Upload size={24} /><b style={{ fontSize: 16 }}>{isDragActive ? "Drop it here" : "Drop your resume here"}</b><span className="small">PDF, DOCX or TXT, up to 10 MB. Or click to browse.</span></>
                )}
              </div>
            ) : (
              <TextArea label="Resume text" rows={11} value={pasted} onChange={setPasted}
                placeholder={"JOHN DOE\njohn@email.com | +1 555-0100\n\nSUMMARY\nExperienced software engineer…"}
                hint={pasted ? `${wordCount(pasted)} words` : undefined} />
            )}

            <h3 className="h-step" style={{ fontSize: 28, marginTop: 34 }}>Aim it</h3>
            <p className="small" style={{ margin: "0 0 14px" }}>Optional. Point the rewrite at a specific job.</p>
            <div className="col">
              <Field label="Target job title" optional value={jobTitle} onChange={setJobTitle} placeholder="Senior Data Scientist" />
              <TextArea label="Job description" optional rows={5} value={jobDesc} onChange={setJobDesc} placeholder="Paste the posting and the wording gets matched to it." />
              <div>
                <div className="label" id="focus-label">Focus on</div>
                <div role="group" aria-labelledby="focus-label" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {FOCUS.map(x => <button key={x} type="button" className="chip" aria-pressed={focus.includes(x)} onClick={() => toggleFocus(x)}>{x}</button>)}
                </div>
              </div>
            </div>

            <h3 className="h-step" style={{ fontSize: 28, marginTop: 34 }}>Cover letter</h3>
            <div className="col" style={{ marginTop: 14 }}>
              <Check id="genCL" checked={genCL} onChange={setGenCL}>Also write one <span className="small" style={{ fontWeight: 500 }}>(uses the job description)</span></Check>
              {genCL && (
                <div className="grid2">
                  <Field label="Company" value={company} onChange={setCompany} placeholder="Microsoft" />
                  <Select label="Tone" value={tone} onChange={setTone} options={TONES} />
                </div>
              )}
            </div>
          </div>
          <div className="ws-foot">
            <button className="btn btn-blue btn-block" onClick={enhance} disabled={loading || extracting}>
              {loading ? <><Spinner /> Editing…</> : <><Highlighter size={16} /> Enhance resume</>}
            </button>
          </div>
        </section>

        {/* ── Canvas ───────────────────────────────────────────────────── */}
        <section className="ws-canvas" aria-label="Result" aria-live="polite">
          {result ? (
            <>
              <CanvasBar>
                <Segmented label="Version" value={view} onChange={setView}
                  options={[
                    { value: "changes" as const, label: "Changes" },
                    { value: "clean" as const, label: "Clean" },
                    { value: "original" as const, label: "Original" },
                    ...(result.cover_letter ? [{ value: "letter" as const, label: "Cover letter" }] : []),
                  ]} />
                <DownloadGate attemptId={result.attempt_id} onDownload={fmt => downloadEnhanced(result.attempt_id, fmt)} />
              </CanvasBar>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", padding: "12px 22px 0", fontSize: 13.5 }} className="num">
                <span><b>{result.original_word_count}</b> → <b>{result.enhanced_word_count}</b> words ({delta >= 0 ? "+" : "−"}{Math.abs(delta)})</span>
                {diff && <span><mark className="mk">{diff.ins} added</mark></span>}
                {diff && <span style={{ color: "var(--bad)" }}>{diff.del} removed</span>}
              </div>
              <div className="artboard">
                {view === "changes" && diff ? <DiffSheet lines={diff.lines} />
                  : view === "original" ? <ResumeText text={original} />
                  : view === "letter" && result.cover_letter ? <article className="sheet sheet-letter" aria-label="Cover letter">{result.cover_letter}</article>
                  : <ResumeText text={result.enhanced_text} />}
              </div>
            </>
          ) : (
            <>
              <CanvasBar>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{source.trim() ? "Your resume" : "Preview"}</span>
                <span className="small">{source.trim() ? `${wordCount(source)} words` : "Nothing loaded yet"}</span>
              </CanvasBar>
              <div className="artboard">
                {source.trim()
                  ? <ResumeText text={source} />
                  : <EmptyCanvas title="Drop a resume">It appears here as soon as it’s read. After you press Enhance, every change is marked on the page.</EmptyCanvas>}
              </div>
            </>
          )}
          {loading && <Working>Editing your resume…</Working>}
        </section>
      </div>
    </AppShell>
  );
}
