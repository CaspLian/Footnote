/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FDFDFC',
          100: '#FAFAF8',
          200: '#F4F4F0',
          300: '#EAEAE4',
        },
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488', // Primary Figma Teal
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
        },
        ink: {
          primary: '#111827',
          secondary: '#4B5563',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'card': '0 2px 4px -1px rgba(15, 23, 42, 0.04), 0 6px 16px -2px rgba(15, 23, 42, 0.05)',
        'elevated': '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
        'teal-glow': '0 10px 25px -4px rgba(13, 148, 136, 0.2), 0 4px 10px -2px rgba(13, 148, 136, 0.1)',
        'modal': '0 25px 50px -12px rgba(15, 23, 42, 0.22)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
