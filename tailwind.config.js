/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        excelr8: {
          dark: '#0a0a0a',
          'dark-accent': '#1a1a1a',
          green: {
            50: '#f0fdf4',
            100: '#dcfce7',
            200: '#bbf7d0',
            300: '#86efac',
            400: '#4ade80',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
            900: '#14532d',
            950: '#052e16',
          },
          emerald: {
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
          },
          gray: {
            800: '#1f2937',
            700: '#374151',
            600: '#4b5563',
          }
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
        'gradient-green': 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)',
        'gradient-excelr8': 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-green-lg': '0 0 40px rgba(16, 185, 129, 0.5)',
        'glow-emerald': '0 0 20px rgba(52, 211, 153, 0.3)',
        'glow-emerald-lg': '0 0 40px rgba(52, 211, 153, 0.5)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.6s ease-out',
        'slideInLeft': 'slideInLeft 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInRight': 'slideInRight 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInUp': 'slideInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInDown': 'slideInDown 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInFromTop': 'slideInFromTop 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInFromBottom': 'slideInFromBottom 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideHorizontal': 'slideHorizontal 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        'scaleIn': 'scaleIn 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInFromTop: {
          '0%': { opacity: '0', transform: 'translateY(-100px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInFromBottom: {
          '0%': { opacity: '0', transform: 'translateY(100px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideHorizontal: {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '50%': { opacity: '0.5' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}