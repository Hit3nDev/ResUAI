"use client";
import { Suspense } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { authSignup } from "@/lib/api";
import Logo from "@/components/Logo";
import toast from "react-hot-toast";

const PERKS = [
  "Download resumes as DOCX & PDF",
  "Save & edit resumes anytime",
  "Full session history",
  "ATS score tracking",
];

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login, user, loading } = useAuth();
  const redirect = searchParams.get("redirect") || "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => { if (!loading && user) router.replace(redirect); }, [user, loading]);

  const pwStrength = password.length >= 12 ? "strong" : password.length >= 8 ? "good" : password.length > 0 ? "weak" : "";
  const strengthColor = { strong: "#00C896", good: "#0EA5E9", weak: "#F59E0B", "": "transparent" }[pwStrength];
  const strengthWidth = { strong: "100%", good: "66%", weak: "33%", "": "0%" }[pwStrength];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const res = await authSignup(email, password, confirm);
      login(res.access_token, res.user);
      toast.success("Account created! Welcome to ResUAI.");
      router.replace(redirect);
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
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
      backgroundImage: "radial-gradient(ellipse at 20% 30%, rgba(0,200,150,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(14,165,233,0.06) 0%, transparent 55%)",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
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
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E8EEF8", letterSpacing: "-0.025em", marginBottom: 6 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: "#7A8BA8" }}>
              Free forever. No credit card required.
            </p>
          </div>

          {/* Perks */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            marginBottom: 24, padding: "14px",
            background: "rgba(0,200,150,0.04)",
            border: "1px solid rgba(0,200,150,0.1)",
            borderRadius: 10,
          }}>
            {PERKS.map(p => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#7A8BA8" }}>
                <CheckCircle size={12} color="#00C896" style={{ flexShrink: 0 }} />
                {p}
              </div>
            ))}
          </div>

          <form onSubmit={submit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={15} color="#3D5270" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input type="email" className="field" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" style={{ paddingLeft: 38 }}
                  autoComplete="email" required />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} color="#3D5270" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input type={showPw ? "text" : "password"} className="field" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" style={{ paddingLeft: 38, paddingRight: 42 }}
                  autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  {showPw ? <EyeOff size={15} color="#3D5270" /> : <Eye size={15} color="#3D5270" />}
                </button>
              </div>
            </div>

            {/* Strength bar */}
            {password && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 3, background: "#0C1525", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: strengthWidth, background: strengthColor, borderRadius: 100, transition: "width 0.3s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: strengthColor, marginTop: 4, fontWeight: 600 }}>
                  {pwStrength === "strong" ? "Strong password" : pwStrength === "good" ? "Good password" : "Weak — use 8+ characters"}
                </div>
              </div>
            )}

            {/* Confirm password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A8BA8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} color="#3D5270" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input type="password" className="field" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password" style={{
                    paddingLeft: 38,
                    borderColor: confirm && confirm !== password ? "rgba(248,113,113,0.5)" : confirm && confirm === password ? "rgba(0,200,150,0.4)" : undefined,
                  }}
                  autoComplete="new-password" required />
                {confirm && confirm === password && (
                  <CheckCircle size={15} color="#00C896" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)" }} />
                )}
              </div>
              {confirm && confirm !== password && (
                <div style={{ fontSize: 12, color: "#F87171", marginTop: 5 }}>Passwords do not match</div>
              )}
            </div>

            {/* Submit */}
            <button type="submit" className="btn-primary" disabled={busy}
              style={{ width: "100%", padding: "13px", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {busy ? <><div className="spinner" /> Creating account…</> : <>Create Account <ArrowRight size={15} /></>}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#3D5270" }}>
            Already have an account?{" "}
            <Link href={`/login?redirect=${encodeURIComponent(redirect)}`}
              style={{ color: "#00C896", fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/" style={{ fontSize: 13, color: "#3D5270", textDecoration: "none" }}>← Back to ResUAI</Link>
        </div>
      </div>
    </div>
  );
}
