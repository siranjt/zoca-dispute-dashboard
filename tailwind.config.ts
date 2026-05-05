import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        zoca: {
          ink: '#0E1116',
          surface: '#FFFFFF',
          subtle: '#F5F6F8',
          border: '#E3E5EA',
          muted: '#6B7280',
          brand: '#4F46E5',
          danger: '#DC2626',
          warn: '#D97706',
          ok: '#059669',
        },
      },
    },
  },
  plugins: [],
};

export default config;
