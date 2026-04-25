import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces semânticas
        page:             'var(--bg-page)',
        sidebar:          'var(--bg-sidebar)',
        surface:          'var(--bg-surface)',
        'surface-hover':  'var(--bg-surface-hover)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        muted:            'var(--bg-muted)',

        // Foreground/Text
        fg:               'var(--text-primary)',
        'fg-secondary':   'var(--text-secondary)',
        'fg-tertiary':    'var(--text-tertiary)',
        'fg-disabled':    'var(--text-disabled)',
        'fg-on-dark':     'var(--text-on-dark)',
        'fg-gold-on-dark': 'var(--text-gold-on-dark)',

        // Borders
        'border-subtle':   'var(--border-subtle)',
        'border-default':  'var(--border-default)',
        'border-strong':   'var(--border-strong)',
        'border-ornament': 'var(--border-ornament)',

        // Brand
        'brand-green': {
          DEFAULT: 'var(--brand-green)',
          soft:    'var(--brand-green-soft)',
          text:    'var(--brand-green-text)',
          hover:   'var(--brand-green-hover)',
        },
        'brand-gold': {
          DEFAULT: 'var(--brand-gold)',
          hover:   'var(--brand-gold-hover)',
          active:  'var(--brand-gold-active)',
          soft:    'var(--brand-gold-soft)',
          text:    'var(--brand-gold-text)',
        },

        // Semantic
        danger: {
          DEFAULT: 'var(--danger)',
          soft:    'var(--danger-soft)',
          text:    'var(--danger-text)',
          border:  'var(--danger-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft:    'var(--warning-soft)',
          text:    'var(--warning-text)',
          border:  'var(--warning-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft:    'var(--success-soft)',
          text:    'var(--success-text)',
          border:  'var(--success-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft:    'var(--info-soft)',
          text:    'var(--info-text)',
          border:  'var(--info-border)',
        },

        // Chat
        'chat-them':      'var(--chat-bubble-them)',
        'chat-them-text': 'var(--chat-bubble-them-text)',
        'chat-me':        'var(--chat-bubble-me)',
        'chat-me-text':   'var(--chat-bubble-me-text)',
        'chat-me-time':   'var(--chat-bubble-me-time)',

        // Legacy cajado palette (preservado para compatibilidade)
        cajado: {
          50:  '#FFF8EC',
          100: '#FFECC8',
          200: '#FFD98A',
          400: '#F59E0B',
          600: '#D97706',
          800: '#92400E',
          900: '#451A03',
        },
      },
      fontFamily: {
        sans:      ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif:     ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        mono:      ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        syne:      ['Syne', 'sans-serif'],
        editorial: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderWidth: {
        hairline: '0.5px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        focus: '0 0 0 3px var(--focus-ring)',
        // Sem outras sombras — hierarquia é por cor
      },
    },
  },
  plugins: [],
}

export default config
