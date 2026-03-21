"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Zap, Target, Clock, Menu, X, LogIn, LogOut, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import Logo from "@/components/Logo";
import toast from "react-hot-toast";

const links = [
  { href: "/",        label: "Dashboard" },
  { href: "/builder", label: "Resume Builder" },
  { href: "/enhance", label: "Enhance Resume" },
  { href: "/ats",     label: "ATS Analyzer" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const path   = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function handleLogout() {
    logout();
    setUserMenuOpen(false);
    toast.success("Logged out successfully");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50" style={{
      background: "rgba(4,11,20,0.92)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      borderBottom: "1px solid rgba(22,32,52,0.8)",
    }}>
      <nav className="max-w-[1320px] mx-auto px-6 h-[64px] flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center no-underline" style={{ flexShrink: 0 }}>
          <Logo size={28} />
        </Link>

        {/* ── Desktop nav links ────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-1 mx-6">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`nav-link ${path === l.href ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* ── Right side ───────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {!loading && (
            user ? (
              /* Authenticated — user avatar + dropdown */
              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(p => !p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 14px",
                    background: "rgba(0,200,150,0.08)",
                    border: "1px solid rgba(0,200,150,0.2)",
                    borderRadius: 10, cursor: "pointer",
                    transition: "all 0.2s",
                    color: "#E8EEF8", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.14)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,200,150,0.08)"; }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "linear-gradient(135deg, #00C896, #0EA5E9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "#040B14",
                  }}>
                    {user.email[0].toUpperCase()}
                  </div>
                  <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email.split("@")[0]}
                  </span>
                  <ChevronDown size={13} color="#7A8BA8" style={{ transform: userMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0,
                    background: "#080F1C",
                    border: "1px solid #162034",
                    borderRadius: 12, padding: "8px",
                    minWidth: 200, zIndex: 100,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}>
                    {/* User info */}
                    <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid #162034", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: "#3D5270", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Signed in as</div>
                      <div style={{ fontSize: 13, color: "#E8EEF8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                    </div>
                    <Link href="/history" onClick={() => setUserMenuOpen(false)}>
                      <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", color: "#7A8BA8", fontSize: 13, fontFamily: "inherit", borderRadius: 8, transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0C1525"; (e.currentTarget as HTMLButtonElement).style.color = "#E8EEF8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#7A8BA8"; }}>
                        <Clock size={14} /> My Resumes
                      </button>
                    </Link>
                    <button onClick={handleLogout}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", color: "#F87171", fontSize: 13, fontFamily: "inherit", borderRadius: 8, transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Not authenticated */
              <>
                <Link href="/login">
                  <button className="btn-ghost" style={{ padding: "8px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <LogIn size={14} /> Log In
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
                    Sign Up Free
                  </button>
                </Link>
              </>
            )
          )}
          {/* Always show Create Resume */}
          {!loading && !user && (
            <div style={{ width: 1, height: 24, background: "#162034" }} />
          )}
          {!loading && user && (
            <Link href="/builder">
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
                Create Resume
              </button>
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden btn-ghost" style={{ padding: "8px" }} onClick={() => setMobileOpen(p => !p)}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ borderTop: "1px solid #162034", background: "#040B14", padding: "12px 24px 20px" }}>
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`side-nav-link ${path === l.href ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid #162034", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {user ? (
              <>
                <div style={{ fontSize: 13, color: "#7A8BA8", padding: "4px 0" }}>{user.email}</div>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, justifyContent: "center", color: "#F87171" }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <button className="btn-ghost" style={{ width: "100%" }}>Log In</button>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <button className="btn-primary" style={{ width: "100%" }}>Sign Up Free</button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
