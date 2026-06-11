/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper, #F7F3EC)',
        card: 'var(--card, #FFFFFF)',
        ink: 'var(--ink, #1B1A17)',
        muted: 'var(--muted, #6E685D)',
        line: 'var(--line, #E5DDCF)',
        brand: 'var(--brand, #1F4D46)',
        'brand-soft': 'var(--brand-soft, #E7EEEB)',
        safe: '#2E7D52',
        'safe-bg': '#E6F2EA',
        soon: '#B5791C',
        'soon-bg': '#FBF0DA',
        urgent: '#B23A2E',
        'urgent-bg': '#F8E4E0',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,26,23,.05), 0 8px 24px rgba(27,26,23,.06)',
        'card-hover': '0 2px 4px rgba(27,26,23,.06), 0 14px 30px rgba(27,26,23,.09)',
      },
    },
  },
  plugins: [],
};
