import type { Block } from "@/components/ResumeSheet";

export interface DraftForm {
  name: string; email: string; phone: string; loc: string; linkedin: string; site: string;
  role: string; summary: string;
  exps: { company: string; title: string; duration: string; location: string; bullets: string }[];
  edus: { degree: string; school: string; year: string; gpa: string }[];
  tech: string; soft: string; certs: string; projects: string; langs: string; awards: string;
}

const lines = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);
const csv   = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

/**
 * Build the "live draft" — the user's own input laid out as a resume, updating as they type.
 * Empty parts show greyed placeholders so the shape of the page is always visible.
 */
export function draftBlocks(f: DraftForm): Block[] {
  const B: Block[] = [];
  const name = f.name.trim();
  B.push({ k: "name", t: name || "Your Name", ph: !name });
  const contact = [f.email, f.phone, f.loc, f.linkedin, f.site].map(s => s.trim()).filter(Boolean).join("  |  ");
  B.push({ k: "contact", t: contact || "email  |  phone  |  location", ph: !contact });

  B.push({ k: "section", t: "Summary" });
  const sum = f.summary.trim();
  B.push({
    k: "txt", ph: !sum,
    t: sum || (f.role.trim() ? `${f.role.trim()} — the AI writes this paragraph for you.` : "The AI writes a summary from the details you add."),
  });

  B.push({ k: "section", t: "Experience" });
  const exps = f.exps.filter(e => e.company.trim() || e.title.trim());
  if (!exps.length) {
    B.push({ k: "head", t: "Company", r: "Dates", ph: true });
    B.push({ k: "sub", t: "Job title", ph: true });
    B.push({ k: "li", t: "What you did, with numbers where you have them.", ph: true });
  }
  for (const e of exps) {
    B.push({ k: "head", t: e.company.trim() || "Company", r: e.duration.trim(), ph: !e.company.trim() });
    const sub = [e.title.trim(), e.location.trim()].filter(Boolean).join(" · ");
    if (sub) B.push({ k: "sub", t: sub });
    for (const b of lines(e.bullets)) B.push({ k: "li", t: b });
  }

  const edus = f.edus.filter(e => e.degree.trim() || e.school.trim());
  if (edus.length) {
    B.push({ k: "section", t: "Education" });
    for (const e of edus) {
      B.push({ k: "head", t: e.school.trim() || "Institution", r: e.year.trim(), ph: !e.school.trim() });
      const sub = [e.degree.trim(), e.gpa.trim()].filter(Boolean).join(" · ");
      if (sub) B.push({ k: "sub", t: sub });
    }
  }

  const tech = csv(f.tech), soft = csv(f.soft);
  if (tech.length || soft.length) {
    B.push({ k: "section", t: "Skills" });
    if (tech.length) B.push({ k: "skill", label: "Technical", t: tech.join(", ") });
    if (soft.length) B.push({ k: "skill", label: "Soft skills", t: soft.join(", ") });
  }

  for (const [title, raw] of [["Certifications", f.certs], ["Projects", f.projects], ["Languages", f.langs], ["Awards", f.awards]] as const) {
    const items = lines(raw);
    if (!items.length) continue;
    B.push({ k: "section", t: title });
    for (const it of items) B.push({ k: "li", t: it });
  }
  return B;
}
