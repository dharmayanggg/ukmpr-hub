/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--theme-color) / <alpha-value>)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
