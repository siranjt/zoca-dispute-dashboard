import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds — deep purple-black canvas
        canvas: '#0A0617',
        surface: '#14092A',
        elevated: '#1A0F35',
        input: '#1F1438',

        // Borders — subtle purple
        line: {
          DEFAULT: '#2A1B4D',
          strong: '#3D2A66',
          soft: '#1F1438',
        },

        // Text
        ink: {
          DEFAULT: '#FFFFFF',
          muted: '#A797C4',
          dim: '#6F5E8E',
          faint: '#4C3F6B',
        },

        // Accents
        accent: {
          pink: '#F0A5CE',
          'pink-strong': '#EC4899',
          'pink-bg': '#3D1A3A',
          purple: '#A78BFA',
          'purple-strong': '#8B5CF6',
          'purple-bg': '#2D1B4E',
          green: '#4ADE80',
          'green-bg': '#1B3D2E',
          yellow: '#FDE047',
          'yellow-bg': '#3D341B',
          red: '#F87171',
          'red-bg': '#3D1B1B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'pink-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #F0A5CE 100%)',
        'page-glow':
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.15), transparent), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(236, 72, 153, 0.08), transparent)',
      },
    },
  },
  plugins: [],
};

export default config;
