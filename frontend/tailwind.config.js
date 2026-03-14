/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "flash-green": "flashGreen 0.6s ease-out",
        "flash-red":   "flashRed 0.6s ease-out",
      },
      keyframes: {
        flashGreen: {
          "0%":   { backgroundColor: "rgba(34,197,94,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        flashRed: {
          "0%":   { backgroundColor: "rgba(239,68,68,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        rupeezy: {
          primary:   "#6366f1",
          secondary: "#8b5cf6",
          accent:    "#06b6d4",
          neutral:   "#1e293b",
          "base-100": "#0f172a",
          "base-200": "#1e293b",
          "base-300": "#334155",
          info:    "#38bdf8",
          success: "#22c55e",
          warning: "#f59e0b",
          error:   "#ef4444",
        },
      },
      "dark",
    ],
    defaultTheme: "rupeezy",
    darkTheme: "rupeezy",
  },
};
