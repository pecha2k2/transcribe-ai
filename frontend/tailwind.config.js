/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        'background-secondary': '#12121a',
        card: '#1a1a24',
        border: '#2a2a3a',
        'text-primary': '#ffffff',
        'text-secondary': '#a0a0b0',
        accent: {
          purple: '#8b5cf6',
          cyan: '#06b6d4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)'
      }
    }
  },
  plugins: []
};
