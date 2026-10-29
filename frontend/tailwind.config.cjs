/** @type {import('tailwindcss').Config} */
// Replaces the cdn.tailwindcss.com Play CDN, which compiled styles in the browser on
// every page load and broke entirely on networks that block external CDNs.
module.exports = {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        // Used by the sign-in panel. Applied through motion-safe: only, so it
        // never animates for someone who has asked the system for less motion.
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
