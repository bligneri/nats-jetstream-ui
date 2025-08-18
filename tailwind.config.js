/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "jet-dark": "#1a1d24",
        "jet-dark-200": "#232730",
        "jet-dark-300": "#2c313a",
        "jet-dark-400": "#3b414c",
        "jet-light": "#f0f2f5",
        "jet-light-200": "#e4e6eb",
        "jet-accent": "#3b82f6",
        "jet-accent-hover": "#2563eb",
        "jet-text": "#d1d5db",
        "jet-text-secondary": "#9ca3af",
        "jet-success": "#10b981",
        "jet-warning": "#f59e0b",
        "jet-danger": "#ef4444",
      },
    },
  },
  plugins: [],
};
