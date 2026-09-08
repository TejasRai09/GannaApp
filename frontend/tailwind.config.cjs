/** @type {import('tailwindcss').Config} */
// Replaces the cdn.tailwindcss.com Play CDN, which compiled styles in the browser on
// every page load and broke entirely on networks that block external CDNs.
// Default theme only — this is what the CDN was serving, so the UI is unchanged.
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
    extend: {},
  },
  plugins: [],
};
