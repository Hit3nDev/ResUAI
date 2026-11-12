"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import AuthShell from "@/components/AuthShell";
import { Field, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { authSignup, safeRedirect } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function strength(pw: string) {
  if (!pw) return { n: 0, label: "", color: "var(--line)" };
  if (pw.length < 8) return { n: 1, label: "Too short. Use at least 8 characters.", color: "var(--bad)" };
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return [
    { n: 1, label: "Okay", color: "var(--warn)" }, { n: 2, label: "Okay", color: "var(--warn)" },
    { n: 3, label: "Good", color: "var(--ok)" },   { n: 4, label: "Strong", color: "var(--ok)" },
  ][s - 1];
}

export default function SignupPage() {
  return <Suspense><SignupInner /></Suspense>;
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();
  const redirect = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string; form?: string }>({});

  useEffect(() => { if (!loading && user) router.replace(redirect); }, [user, loading, redirect, router]);

  const st = strength(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) er.email = "Enter a valid email address.";
    if (password.length < 8) er.password = "Use at least 8 characters.";
    if (confirm !== password) er.confirm = "The passwords don’t match.";
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const res = await authSignup(email.trim(), password, confirm);
      login(res.access_token, res.user);
      toast.success("Account created. Welcome to ResUAI.");
      router.replace(redirect);
    } catch (err: any) {
      setErrors({ form: err.message || "Couldn’t create the account." });
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Sign up" lede="Free, no card. You can download Word and PDF files straight away."
      footer={<>Already have an account? <Link className="link" href={`/login?redirect=${encodeURIComponent(redirect)}`}>Sign in</Link></>}>
      <form onSubmit={submit} noValidate className="col" style={{ gap: 18 }}>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} />

        <div>
          <label className="label" htmlFor="pw">Password</label>
          <div style={{ position: "relative" }}>
            <input id="pw" className="input" type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" placeholder="At least 8 characters" style={{ paddingRight: 44 }} aria-invalid={!!errors.password || undefined} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
              className="btn btn-quiet btn-sm" style={{ position: "absolute", right: 4, top: 4, width: 32, padding: 0 }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <div aria-live="polite" style={{ marginTop: 9 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                {[1, 2, 3, 4].map(i => <i key={i} style={{ height: 4, background: i <= st.n ? st.color : "var(--line)" }} />)}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: st.color, marginTop: 6 }}>{st.label}</div>
            </div>
          )}
          {errors.password && <div className="err" role="alert">{errors.password}</div>}
        </div>

        <Field label="Confirm password" type={show ? "text" : "password"} value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />

        <div role="alert" aria-live="assertive">{errors.form && <div className="err" style={{ marginTop: 0 }}>{errors.form}</div>}</div>

        <button type="submit" className="btn btn-blue btn-lg btn-block" disabled={busy}>
          {busy ? <><Spinner /> Creating account…</> : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
