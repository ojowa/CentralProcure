/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nis-green': '#008000',
        'nis-red': '#FF0000',
        'nis-white': '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
