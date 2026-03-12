/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nis-green': '#008000', // A common shade of green for official use
        'nis-red': '#FF0000',   // Standard red
        'nis-white': '#FFFFFF', // Pure white
      },
    },
  },
  plugins: [],
}
