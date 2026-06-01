/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F3EC',
        card: '#FFFFFF',
        ink: '#1B1A17',
        muted: '#6E685D',
        line: '#E5DDCF',
        brand: '#1F4D46',
        'brand-soft': '#E7EEEB',
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
