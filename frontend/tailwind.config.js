/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Geist'", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'Geist Mono'", "monospace"],
      },
      colors: {
        bg: {
          base: "#040B14",
          card: "#080F1C",
          raised: "#0C1525",
          border: "#162034",
          hover: "#0F1E35",
        },
        brand: {
          green: "#00C896",
          "green-dim": "#00C89620",
          "green-border": "#00C89640",
          blue: "#0EA5E9",
          "blue-dim": "#0EA5E920",
        },
        text: {
          primary: "#E8EEF8",
          secondary: "#7A8BA8",
          muted: "#3D5270",
          accent: "#00C896",
        },
      },
      backgroundImage: {
        "grid-pattern": "linear-gradient(rgba(0,200,150,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,150,0.03) 1px, transparent 1px)",
        "hero-glow": "radial-gradient(ellipse at 20% 50%, rgba(0,200,150,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(14,165,233,0.05) 0%, transparent 60%)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
      },
      backgroundSize: {
        "grid-sm": "40px 40px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,150,0.15)",
        glow: "0 0 24px rgba(0,200,150,0.2)",
        "glow-sm": "0 0 12px rgba(0,200,150,0.15)",
        btn: "0 2px 8px rgba(0,200,150,0.3), 0 0 0 1px rgba(0,200,150,0.4)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease both",
        "fade-in": "fadeIn 0.4s ease both",
        float: "float 4s ease-in-out infinite",
        pulse_slow: "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        float: { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-8px)" } },
      },
    },
  },
  plugins: [],
};
