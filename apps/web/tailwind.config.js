/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sidcord brand
        brand: {
          50: '#E6FAF4',
          100: '#CCF5E9',
          200: '#99EAD3',
          300: '#66DFBD',
          400: '#33D5A7',
          500: '#00D9A6', // primary brand
          600: '#00A982',
          700: '#00805F',
          800: '#005740',
          900: '#002E22',
        },
        accent: {
          400: '#FF8585',
          500: '#FF6B6B', // coral secondary
          600: '#E54848',
        },
        // Yüzey skala (tabandan tepe doğru)
        bg: '#0E1117',
        surface: {
          1: '#161B22',
          2: '#1F2530',
          3: '#2A3140',
        },
        line: '#2D333B',
        ink: {
          primary: '#E6EDF3',
          secondary: '#9CA3AF',
          tertiary: '#6B7280',
          muted: '#484F58',
        },
        // Status
        status: {
          online: '#10B981',
          idle: '#F59E0B',
          dnd: '#EF4444',
          offline: '#6B7280',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0, 217, 166, 0.4), 0 0 12px rgba(0, 217, 166, 0.25)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
};
