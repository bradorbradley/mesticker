import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#7C5CFC",
          foreground: "#FFFFFF",
          light: "#A78BFA",
          dark: "#5B3FD6",
        },
        accent: {
          pink: "#FF6B9D",
          orange: "#FF9F43",
          yellow: "#FECA57",
          green: "#2ED573",
          cyan: "#45E3FF",
          blue: "#5B9FFF",
        },
        secondary: {
          DEFAULT: "#FF6B9D",
          foreground: "#FFFFFF",
        },
        background: "#FEFCFF",
        surface: "#FFFFFF",
        muted: {
          DEFAULT: "#F5F3FF",
          foreground: "#7C7C8A",
        },
        success: "#2ED573",
        border: "#EDE9FE",
        ring: "#7C5CFC",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(124, 92, 252, 0.3)",
        "glow-lg": "0 0 40px rgba(124, 92, 252, 0.4)",
        "glow-pink": "0 0 20px rgba(255, 107, 157, 0.3)",
        soft: "0 2px 20px rgba(0, 0, 0, 0.06)",
        "soft-lg": "0 4px 30px rgba(0, 0, 0, 0.08)",
        card: "0 8px 30px rgba(124, 92, 252, 0.12)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delay": "float 6s ease-in-out 2s infinite",
        "float-slow": "float 8s ease-in-out 1s infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin 4s linear infinite",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-up": "slide-up 0.4s ease-out",
        wiggle: "wiggle 0.5s ease-in-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(2deg)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
