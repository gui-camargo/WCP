/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e7ff',
          500: '#0052cc',
          600: '#0044a8',
          700: '#003d99',
          900: '#002966',
        },
        accent: {
          50:  '#fff5ed',
          100: '#ffead5',
          500: '#ff6600',
          600: '#dd5500',
          700: '#bb4400',
          900: '#663300',
        },
      },
      fontFamily: {
        'bebas': ['Bebas Neue', 'cursive'],
        'sora': ['Sora', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

