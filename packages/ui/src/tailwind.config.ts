import type { Config } from 'tailwindcss';

export const tailwindConfig: Config = {
  darkMode: 'class',
  content: [
    // This will be overridden by the consuming app
  ],
  theme: {
    extend: {
      colors: {
        // AIOS Liquid Glass Palette
        background: '#09090B',
        foreground: '#F4F4F5',
        muted: {
          DEFAULT: 'rgba(244, 244, 245, 0.5)',
          foreground: 'rgba(244, 244, 245, 0.4)',
        },
        accent: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
          glow: 'rgba(59, 130, 246, 0.4)',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          foreground: '#FFFFFF',
          glow: 'rgba(139, 92, 246, 0.4)',
        },
        success: {
          DEFAULT: '#22C55E',
          glow: 'rgba(34, 197, 94, 0.4)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.4)',
        },
        danger: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.4)',
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          strong: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-focus': 'rgba(59, 130, 246, 0.4)',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        glass: '20px',
        'glass-strong': '40px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'accent-glow': '0 0 20px rgba(59, 130, 246, 0.3)',
        'purple-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'success-glow': '0 0 15px rgba(34, 197, 94, 0.3)',
      },
      borderRadius: {
        glass: '16px',
        'glass-sm': '12px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'glass-shimmer': 'glass-shimmer 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glass-shimmer': {
          '0%, 100%': { backgroundPosition: '200% center' },
          '50%': { backgroundPosition: '-200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
