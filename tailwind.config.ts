import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F7F8',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        line: '#F0F1F3',
        ink: '#1F2430',
        dim: '#5F6673',
        primary: { DEFAULT: '#C2410C', dark: '#9A3412', soft: '#FFEDD5' },
        accent: '#EA580C',
        success: '#166534',
        danger: '#B91C1C',
      },
      fontFamily: { sans: ['var(--font-inter)', 'var(--font-thai)', 'system-ui', 'sans-serif'] },
    },
  },
};

export default config;
