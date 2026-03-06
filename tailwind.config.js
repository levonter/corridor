/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      colors: {
        navy: {
          950: '#080C16',
          900: '#0C1020',
          850: '#0E1224',
          800: '#111628',
          700: '#161B30',
          600: '#1A2038',
          500: '#252A42',
          400: '#1A1E35',
          300: '#14182A',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#D4B86A',
          dark: '#8B6914',
          bg: 'rgba(201,168,76,0.08)',
        },
        parchment: {
          50: '#FFF',
          100: '#FAF7F2',
          200: '#F5F0E8',
          300: '#F0EBE1',
          400: '#E8DFD1',
          500: '#E0D5C4',
          600: '#DDD5C5',
          700: '#C4B69C',
          800: '#B8A88A',
        },
        brown: {
          50: '#FAF7F2',
          100: '#E8DFD1',
          200: '#8B7355',
          300: '#6B5B45',
          400: '#3D2B1F',
          500: '#8B6914',
        },
        crisis: {
          critical: '#E8553A',
          'critical-bg': 'rgba(232,85,58,0.12)',
          'critical-glow': 'rgba(232,85,58,0.53)',
          high: '#E89B2A',
          'high-bg': 'rgba(232,155,42,0.08)',
          medium: '#C9A84C',
          'medium-bg': 'rgba(201,168,76,0.10)',
          low: '#5AAE7A',
          'low-bg': 'rgba(90,174,122,0.10)',
        },
        ink: {
          primary: '#E0DCD4',
          secondary: '#A8A0B0',
          muted: '#6B6580',
          faint: '#3E3852',
        },
        status: {
          success: '#5AAE7A',
          warning: '#E89B2A',
          danger: '#E8553A',
          info: '#4BA8CC',
        },
      },
      boxShadow: {
        'crisis-sm': '0 1px 3px rgba(0,0,0,.4)',
        'crisis-md': '0 2px 10px rgba(0,0,0,.5)',
        'crisis-lg': '0 4px 24px rgba(0,0,0,.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
        'blink': 'blink 1.2s infinite',
        'pulse-glow': 'glowPulse 1.5s ease-in-out infinite',
        'spin-fast': 'spin 0.8s linear infinite',
        'dash-flow': 'dashFlow 2s linear infinite',
        'dash-fast': 'dashFlowFast 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.15' },
        },
        glowPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '.9' },
          '50%': { transform: 'scale(1.4)', opacity: '.3' },
        },
        dashFlow: { to: { strokeDashoffset: '-40' } },
        dashFlowFast: { to: { strokeDashoffset: '-20' } },
      },
    },
  },
  plugins: [],
}
