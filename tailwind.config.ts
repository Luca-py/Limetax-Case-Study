import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0C14",
        surface: "#111320",
        accent: "#4D6EF6",
        muted: "#5A6080",
        body: "#C8CCE0",
      },
      fontFamily: {
        serif: ["DM Serif Display", "serif"],
        mono: ["DM Mono", "monospace"],
        sans: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
