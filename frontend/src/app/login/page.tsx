"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { authLogin } from "@/lib/api";
import Logo from "@/components/Logo";
import toast from "react-hot-toast";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login, user, loading } = useAuth();
  const redirect = searchParams.get("redirect") || "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);

  // Already logged in → redirect
  useEffect(() => { if (!loading && user) router.replace(redirect); }, [user, loading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setBusy(true);
    try {
      const res = await authLogin(email, password);
      login(res.access_token, res.user);
      toast.success(`Welcome back, ${res.user.email.split("@")[0]}!`);
      router.replace(redirect);
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#040B14",
      backgroundImage: "radial-gradient(ellipse at 25% 30%, rgba(0,200,150,0.07) 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(14,165,233,0.06) 0%, transparent 55%)",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <Link href="/"><Logo size={30} /></Link>
        </div>

        {/* Card */}
        <div style={{
          background: "#080F1C",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18,
          padding: "36px 32px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,150,0.05) inset",
        }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E8EEF8", letterSpacing: "-0.025em", marginBottom: 6 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "#7A8BA8" }}>
              Sign in to download and manage your resumes.
            </p>
          </div>

          {/* Download gate notice */}
          {searchParams.get("redirect") && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 14px",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 10, marginBottom: 20,
              fontSize: 13, color: "#FCD34D",
            }}>
              <Lock size={13} />
              Sign in to download your resume
            </div>
          )}

          <form onSubmit={submit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={15} color="#3D5270" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="email"
                  className="field"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ paddingLeft: 38 }}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} color="#3D5270" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type={showPw ? "text" : "password"}
                  className="field"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: 38, paddingRight: 42 }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
                >
                  {showPw ? <EyeOff size={15} color="#3D5270" /> : <Eye size={15} color="#3D5270" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary"
              disabled={busy}
              style={{ width: "100%", padding: "13px", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {busy ? (
                <><div className="spinner" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#3D5270" }}>
            Don&apos;t have an account?{" "}
            <Link href={`/signup?redirect=${encodeURIComponent(redirect)}`}
              style={{ color: "#00C896", fontWeight: 600, textDecoration: "none" }}>
              Sign up free
            </Link>
          </div>
        </div>

        {/* Back to home */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/" style={{ fontSize: 13, color: "#3D5270", textDecoration: "none" }}>
            ← Back to ResUAI
          </Link>
        </div>
      </div>
    </div>
  );
}
