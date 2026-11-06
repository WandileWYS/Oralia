/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { paper: 'var(--surface)', ink: 'var(--text)', clay: 'var(--accent)', bloom: '#b54f34', sand: '#f5f0e6', cream: '#fffdf9', charcoal: '#2c2722', peach: '#f0e4d7', sage: '#52765e', obsidian: '#0F172A', amber: '#D97706', terracotta: '#b54f34', sandstone: '#faf6ef', emerald: '#059669' },
      fontFamily: { sans: ['"Segoe UI"', 'Arial', 'sans-serif'], display: ['Georgia', 'serif'] },
      scale: { 102: '1.02' },
      borderRadius: { '2xl': 'var(--radius-control)', '3xl': 'var(--radius-card)', full: 'var(--radius-pill)' },
    },
  },
  plugins: [],
};
