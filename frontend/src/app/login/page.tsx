"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import AuthShell from "@/components/AuthShell";
import { Field, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/AuthContext";
import { authLogin, safeRedirect } from "@/lib/api";

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();
  const redirect = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!loading && user) router.replace(redirect); }, [user, loading, redirect, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true);
    try {
      const res = await authLogin(email.trim(), password);
      login(res.access_token, res.user);
      toast.success(`Welcome back, ${res.user.email.split("@")[0]}.`);
      router.replace(redirect);
    } catch (err: any) {
      setError(err.message || "Couldn’t sign you in.");
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Log in"
      lede={params.get("redirect") ? "Sign in to download your resume. It’s waiting for you." : "Sign in to download and manage your resumes."}
      footer={<>New here? <Link className="link" href={`/signup?redirect=${encodeURIComponent(redirect)}`}>Create an account</Link></>}>
      <form onSubmit={submit} noValidate className="col" style={{ gap: 18 }}>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <div>
          <label className="label" htmlFor="pw">Password</label>
          <div style={{ position: "relative" }}>
            <input id="pw" className="input" type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
              className="btn btn-quiet btn-sm" style={{ position: "absolute", right: 4, top: 4, width: 32, padding: 0 }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div role="alert" aria-live="assertive">{error && <div className="err" style={{ marginTop: 0 }}>{error}</div>}</div>
        <button type="submit" className="btn btn-blue btn-lg btn-block" disabled={busy}>
          {busy ? <><Spinner /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
