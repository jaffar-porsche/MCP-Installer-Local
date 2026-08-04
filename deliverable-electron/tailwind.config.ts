import type { Config } from 'tailwindcss';

/**
 * Porsche Engineering — internal tool design tokens.
 *
 * Colors are inspired by Porsche Engineering brand guidelines. All names use
 * the `pag-` prefix (Porsche Engineering Group) so they never collide with
 * generic Tailwind palette names. The intent is a mostly-neutral UI with
 * red used sparingly and confidently for primary calls-to-action.
 */
const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pag: {
          red: {
            DEFAULT: '#D5001C',
            hover: '#EE0024',
            dark: '#B30017',
            faint: '#FDE9EC',
          },
          ink: {
            DEFAULT: '#0A0A0A',
            soft: '#171717',
          },
          bg: {
            DEFAULT: '#FAFAFA',
            surface: '#FFFFFF',
            muted: '#F4F4F5',
          },
          border: '#E4E4E7',
          text: {
            DEFAULT: '#18181B',
            muted: '#71717A',
            faint: '#A1A1AA',
          },
          success: {
            DEFAULT: '#00A85A',
            faint: '#DCFCE7',
          },
          warning: {
            DEFAULT: '#F4A100',
            faint: '#FEF3C7',
          },
          error: {
            DEFAULT: '#E60024',
            faint: '#FEE2E2',
          },
          info: {
            DEFAULT: '#0064C8',
            faint: '#DBEAFE',
          },
        },
      },
      fontFamily: {
        sans: [
          '"Porsche Next"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xxs: ['0.65rem', { lineHeight: '0.9rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        cardHover:
          '0 4px 8px rgba(16, 24, 40, 0.06), 0 2px 4px rgba(16, 24, 40, 0.06)',
        raised:
          '0 10px 32px -8px rgba(16, 24, 40, 0.12), 0 4px 12px -4px rgba(16, 24, 40, 0.08)',
      },
      transitionTimingFunction: {
        pag: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
