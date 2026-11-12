"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Gauge, Highlighter, Home, Library, LogOut, PenLine, User } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/AuthContext";
import { getHealth } from "@/lib/api";

const NAV = [
  { href: "/",        label: "Home",    Icon: Home },
  { href: "/builder", label: "Build",   Icon: PenLine },
  { href: "/enhance", label: "Enhance", Icon: Highlighter },
  { href: "/ats",     label: "Score",   Icon: Gauge },
  { href: "/history", label: "Library", Icon: Library },
];

export default function AppShell({ title, sub, actions, titleAs = "h1", children }: {
  title: string; sub?: string; actions?: ReactNode; titleAs?: "h1" | "p"; children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const [api, setApi] = useState<"…" | "up" | "down">("…");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const ping = () => getHealth().then(() => setApi("up")).catch(() => setApi("down"));
    ping();
    window.addEventListener("focus", ping);
    return () => window.removeEventListener("focus", ping);
  }, []);
  useEffect(() => setMenu(false), [path]);

  function signOut() {
    logout(); setMenu(false);
    toast.success("Signed out");
    router.push("/");
  }

  const cur = (href: string) => (path === href ? "page" : undefined);
  const Title = titleAs;

  return (
    <div className="shell">
      {/* ── Rail (desktop) ─────────────────────────────────────────────── */}
      <aside className="rail d-only">
        <Link href="/" className="rail-logo" aria-label="ResUAI home"><Logo tone="light" size={26} /></Link>
        <nav aria-label="Main">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="nav-item" aria-current={cur(href)}>
              <Icon size={18} strokeWidth={2} /> {label}
            </Link>
          ))}
        </nav>

        <div className="rail-foot">
          {!loading && (user ? (
            <>
              <div className="rail-user">
                <span className="avatar" aria-hidden>{user.email[0].toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="small" style={{ display: "block", color: "#858998", fontSize: 11 }}>Signed in</span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                </span>
              </div>
              <button className="btn btn-sm" onClick={signOut} style={{ background: "#17181F", color: "#fff", justifyContent: "flex-start" }}>
                <LogOut size={14} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-sm" style={{ background: "#17181F", color: "#fff" }}>Log in</Link>
              <Link href="/signup" className="btn btn-sm btn-blue">Create account</Link>
            </>
          ))}
          <div className="status" role="status">
            <i data-s={api === "…" ? undefined : api} />
            {api === "up" ? "Backend online" : api === "down" ? "Backend offline" : "Connecting…"}
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="main">
        <header className="topbar">
          <div className="tb-left">
            <Link href="/" className="m-only" aria-label="ResUAI home"><Logo size={22} /></Link>
            <Title className="tb-title">{title}</Title>
            {sub && <span className="tb-sub d-only">{sub}</span>}
          </div>
          <div className="tb-right">{actions}</div>
        </header>
        {children}
      </div>

      {/* ── Tab bar (mobile) ───────────────────────────────────────────── */}
      <nav className="tabbar" aria-label="Main">
        {NAV.slice(1).map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={cur(href)}><Icon size={20} /> {label}</Link>
        ))}
        {user
          ? <button onClick={() => setMenu(m => !m)} aria-expanded={menu}><User size={20} /> Account</button>
          : <Link href="/login" aria-current={cur("/login")}><User size={20} /> Log in</Link>}
      </nav>
      {menu && user && (
        <div className="sheet-menu" role="menu">
          <div className="small">Signed in as</div>
          <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
          <Link href="/history?tab=saved" className="btn btn-line" role="menuitem">Saved resumes</Link>
          <button className="btn btn-danger" onClick={signOut} role="menuitem"><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
