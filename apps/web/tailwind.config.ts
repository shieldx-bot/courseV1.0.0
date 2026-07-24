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
          700: "#1E3A5F",
          500: "#2E5A8F",
          100: "#E4ECF5",
        },
        accent: {
          600: "#D68A0E",
          500: "#F5A623",
          100: "#FDF0DA",
        },
        neutral: {
          900: "#1A1A18",
          600: "#5F5E5A",
          300: "#B4B2A9",
          100: "#F1EFE8",
          0: "#FFFFFF",
        },
        success: "#3B6D11",
        warning: "#854F0B",
        error: "#A32D2D",
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
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
