import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          900: "#0F1F33",
          800: "#1A2F4A",
          700: "#1E3A5F",
          600: "#254A7F",
          500: "#2E5A8F",
          400: "#4A6B9F",
          300: "#6A8BCF",
          200: "#8AB0DF",
          100: "#E4ECF5",
          50: "#F2F5FA",
        },
        accent: {
          900: "#8A5A06",
          800: "#A96E07",
          700: "#C07C09",
          600: "#D68A0E",
          500: "#F5A623",
          400: "#FFB84D",
          300: "#FFCE7D",
          200: "#FFE0A8",
          100: "#FDF0DA",
          50: "#FFF8ED",
        },
        neutral: {
          950: "#121210",
          900: "#1A1A18",
          800: "#2D2D2A",
          700: "#41403C",
          600: "#5F5E5A",
          500: "#7D7C78",
          400: "#9B9A96",
          300: "#B4B2A9",
          200: "#D1D0CA",
          100: "#F1EFE8",
          50: "#F9F8F6",
          0: "#FFFFFF",
        },
        success: "#3B6D11",
        warning: "#854F0B",
        error: "#A32D2D",
        // Semantic tokens (shadcn-compatible) mapped to the design system
        muted: {
          DEFAULT: "#F1EFE8",
          foreground: "#7D7C78",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A18",
        },
        background: "#FFFFFF",
        foreground: "#1A1A18",
        border: "#D1D0CA",
        input: "#D1D0CA",
        ring: "#F5A623",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A18",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        "page": "1280px",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        sm: "0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.03)",
        md: "0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        lg: "0 4px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)",
        xl: "0 8px 12px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.08)",
        "2xl": "0 16px 24px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.10)",
      },
      spacing: {
        "0.5": "0.125rem",
        "1.5": "0.375rem",
        "2.5": "0.625rem",
        "3.5": "0.875rem",
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "slide-out": "slideOut 0.2s ease-in",
        "fade-in": "fadeIn 0.2s ease-out",
        "fade-out": "fadeOut 0.2s ease-in",
        "scale-in": "scaleIn 0.2s ease-out",
        "scale-out": "scaleOut 0.2s ease-in",
      },
      keyframes: {
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideOut: {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(-20px)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
