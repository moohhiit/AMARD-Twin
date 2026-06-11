/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        rail: {
          dark: "#0a0e17",
          panel: "#111827",
          surface: "#1a2235",
          elevated: "#1f2a40",
          border: "#2a3550",
          track: "#374c6d",
          active: "#3b82f6",
          "active-dim": "#1e3a5f",
          text: "#e2e8f0",
          "text-muted": "#94a3b8",
          "text-dim": "#64748b",
        },
        signal: {
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
          flashing: "#f97316",
        },
        train: {
          running: "#22c55e",
          delayed: "#eab308",
          emergency: "#ef4444",
          stopped: "#64748b",
          approaching: "#3b82f6",
        },
        status: {
          available: "#22c55e",
          reserved: "#eab308",
          occupied: "#ef4444",
          maintenance: "#64748b",
        },
        severity: {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#eab308",
          low: "#3b82f6",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        panel: "0 4px 20px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(59, 130, 246, 0.2)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.2)",
        "glow-red": "0 0 20px rgba(239, 68, 68, 0.3)",
        "glow-yellow": "0 0 20px rgba(234, 179, 8, 0.2)",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(239, 68, 68, 0.4)" },
          "50%": { boxShadow: "0 0 25px rgba(239, 68, 68, 0.8)" },
        },
        "pulse-signal": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "flash-critical": {
          "0%, 100%": { backgroundColor: "rgba(220, 38, 38, 0)" },
          "50%": { backgroundColor: "rgba(220, 38, 38, 0.15)" },
        },
        "track-flow": {
          "0%": { strokeDashoffset: "20" },
          "100%": { strokeDashoffset: "0" },
        },
        "train-move": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-signal": "pulse-signal 1s ease-in-out infinite",
        "flash-critical": "flash-critical 1.5s ease-in-out infinite",
        "track-flow": "track-flow 1s linear infinite",
        "train-move": "train-move 3s linear infinite",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
