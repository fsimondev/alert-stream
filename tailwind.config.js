/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#0e0e16',
          850: '#13131f',
          800: '#191926',
          700: '#23233a',
          600: '#33334d',
        },
        twitch: {
          DEFAULT: '#a970ff',
          glow: '#bf94ff',
        },
        kick: {
          DEFAULT: '#53fc18',
          glow: '#7dff52',
        },
        live: '#ff3b5c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'glow-twitch': '0 0 0 1px rgba(169,112,255,0.35), 0 0 24px -4px rgba(169,112,255,0.5)',
        'glow-kick': '0 0 0 1px rgba(83,252,24,0.30), 0 0 24px -6px rgba(83,252,24,0.45)',
        'glow-live': '0 0 0 1px rgba(255,59,92,0.4), 0 0 18px -2px rgba(255,59,92,0.6)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.82)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'pulse-live': 'pulse-live 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
