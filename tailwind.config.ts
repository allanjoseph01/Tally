import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-geist-mono)', 'IBM Plex Mono', 'monospace'],
        sans: ['var(--font-geist-sans)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        border: {
          default: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          active: 'var(--border-active)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        }
      },
      borderRadius: {
        DEFAULT: '6px',
        none: '0px',
        lg: '10px',
        md: '6px',
        sm: '4px',
      }
    },
  },
  plugins: [],
};

export default config;
