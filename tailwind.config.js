const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        card: c('card'),
        hover: c('hover'),
        line: c('line'),
        fg: c('fg'),
        muted: c('muted'),
        accent: c('accent'),
        accent2: c('accent2'),
        onaccent: c('onaccent'),
        danger: c('danger'),
      },
      fontFamily: {
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        cover: 'var(--cover-radius)',
      },
      boxShadow: {
        glow: '0 0 44px -10px rgb(var(--accent) / 0.65)',
        soft: '0 10px 40px -12px rgb(0 0 0 / 0.5)',
      },
      keyframes: {
        eq: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        eq: 'eq 0.9s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
