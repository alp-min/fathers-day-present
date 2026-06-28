import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core background layers
        canvas: "#f5f5f7",
        surface: "#ffffff",
        "surface-2": "#f0f0f5",
        "surface-3": "#e8e8ef",
        border: "#e5e5ea",
        "border-subtle": "#d1d1d6",

        // Text
        primary: "#111118",
        secondary: "#444455",
        muted: "#666677",

        // Accent
        accent: "#6366f1",
        "accent-dim": "#4f46e5",
        "accent-glow": "rgba(99,102,241,0.15)",

        // Semantic
        gain: "#10b981",
        "gain-dim": "rgba(16,185,129,0.15)",
        loss: "#ef4444",
        "loss-dim": "rgba(239,68,68,0.15)",
        warn: "#f59e0b",
        "warn-dim": "rgba(245,158,11,0.15)",

        // Chart palette
        chart1: "#6366f1",
        chart2: "#8b5cf6",
        chart3: "#06b6d4",
        chart4: "#10b981",
        chart5: "#f59e0b",
        chart6: "#ef4444",
        chart7: "#ec4899",
        chart8: "#14b8a6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Cal Sans", "Inter", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mesh-1":
          "radial-gradient(at 40% 20%, hsla(240,100%,74%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(262,100%,74%,0.06) 0px, transparent 50%)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover":
          "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        glow: "0 0 24px rgba(99,102,241,0.2)",
        "glow-gain": "0 0 16px rgba(16,185,129,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;



