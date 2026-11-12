/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        doc:  ["var(--font-doc)", "Calibri", "sans-serif"],
      },
      colors: {
        ink:  { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        fog:  { DEFAULT: "var(--fog)", 2: "var(--fog-2)" },
        line: { DEFAULT: "var(--line)", 2: "var(--line-2)" },
        blue: { DEFAULT: "var(--blue)", soft: "var(--blue-soft)" },
        hi:   "var(--hi)",
      },
    },
  },
  plugins: [],
};
