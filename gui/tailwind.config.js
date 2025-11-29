/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Native-looking dark theme
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#818cf8',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        'native': '0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)',
        'native-lg': '0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)',
      }
    },
  },
  plugins: [],
}
