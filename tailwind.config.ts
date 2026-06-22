import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // All colors resolve from CSS custom properties so light/dark themes work
        canvas:         "var(--color-canvas)",
        surface:        "var(--color-surface)",
        "surface-2":    "var(--color-surface-2)",
        "surface-3":    "var(--color-surface-3)",
        border:         "var(--color-border)",
        "border-subtle":"var(--color-border-sub)",

        primary:        "var(--color-primary)",
        secondary:      "var(--color-secondary)",
        muted:          "var(--color-muted)",

        accent:         "var(--color-accent)",
        "accent-dim":   "var(--color-accent-dim)",
        "accent-glow":  "var(--color-accent-glow)",

        gain:           "var(--color-gain)",
        "gain-dim":     "var(--color-gain-dim)",
        loss:           "var(--color-loss)",
        "loss-dim":     "var(--color-loss-dim)",
        warn:           "var(--color-warn)",
        "warn-dim":     "var(--color-warn-dim)",

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
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        glow: "0 0 24px rgba(99,102,241,0.2)",
        "glow-gain": "0 0 16px rgba(16,185,129,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
