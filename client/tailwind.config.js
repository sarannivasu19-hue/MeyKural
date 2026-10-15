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
        parchment: {
          50: '#FDFBF7',
          100: '#FAF5E8',
          200: '#F4EBD4',
          300: '#E8D9BA',
          400: '#D5C29A',
          500: '#BAA174',
          800: '#3D3425',
          900: '#231E15',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          800: '#1E293B',
          850: '#141A29',
          900: '#0F172A',
          950: '#090D16',
        },
        temple: {
          green: '#15803D',
          lightGreen: '#22C55E',
          turmeric: '#D97706',
          gold: '#EAB308',
          terracotta: '#B91C1C',
          crimson: '#DC2626',
          amber: '#F59E0B',
          stone: '#78716C',
        }
      },
      fontFamily: {
        tamilSerif: ['"Noto Serif Tamil"', 'serif'],
        tamilSans: ['"Noto Sans Tamil"', 'sans-serif'],
      },
      boxShadow: {
        'wax-seal': '0 8px 24px -4px rgba(185, 28, 28, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
        'wax-seal-green': '0 8px 24px -4px rgba(21, 128, 61, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
        'wax-seal-amber': '0 8px 24px -4px rgba(217, 119, 6, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.1)',
        'parchment-card': '0 4px 20px -2px rgba(186, 161, 116, 0.18), 0 2px 6px -1px rgba(0, 0, 0, 0.05)',
      },
      keyframes: {
        stamp: {
          '0%': { transform: 'scale(2.5) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(0.95) rotate(2deg)', opacity: '1' },
          '80%': { transform: 'scale(1.05) rotate(-1deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' }
        },
        crack: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        stamp: 'stamp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        shimmer: 'shimmer 2s infinite linear'
      }
    },
  },
  plugins: [],
}
