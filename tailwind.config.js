/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { paper: 'var(--surface)', ink: 'var(--text)', clay: 'var(--accent)', sage: '#059669', obsidian: '#0F172A', amber: '#D97706', terracotta: '#EA580C', sandstone: '#FEF3C7', emerald: '#059669' },
      fontFamily: { sans: ['"Segoe UI"', 'Arial', 'sans-serif'], display: ['Georgia', 'serif'] },
    },
  },
  plugins: [],
};
