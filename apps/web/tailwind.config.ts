import type { Config } from "tailwindcss";
import { designTokens } from "./design-tokens";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./__tests__/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: designTokens.colors.background.DEFAULT,
        foreground: designTokens.colors.text.primary.DEFAULT,
        primary: {
          DEFAULT: designTokens.colors.primary.DEFAULT,
          hover: designTokens.colors.primary.hover,
          active: designTokens.colors.primary.active,
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: designTokens.colors.secondary.DEFAULT,
          foreground: designTokens.colors.text.primary.DEFAULT,
        },
        muted: {
          DEFAULT: designTokens.colors.secondary.DEFAULT,
          foreground: designTokens.colors.text.muted.DEFAULT,
        },
        accent: {
          DEFAULT: designTokens.colors.accent.DEFAULT,
          foreground: designTokens.colors.text.primary.DEFAULT,
        },
        destructive: {
          DEFAULT: designTokens.colors.danger.DEFAULT,
          foreground: "#ffffff",
        },
        border: designTokens.colors.border.DEFAULT,
        ring: designTokens.colors.border.focus,
      },
      fontFamily: {
        sans: designTokens.typography.fontFamily.sans,
        mono: designTokens.typography.fontFamily.mono,
      },
      boxShadow: {
        sm: designTokens.shadows.sm.DEFAULT,
        md: designTokens.shadows.md.DEFAULT,
        lg: designTokens.shadows.lg.DEFAULT,
        xl: designTokens.shadows.xl.DEFAULT,
      },
      borderRadius: {
        sm: designTokens.borderRadius.sm,
        md: designTokens.borderRadius.md,
        lg: designTokens.borderRadius.lg,
        xl: designTokens.borderRadius.xl,
        full: designTokens.borderRadius.full,
      },
      spacing: {
        ...designTokens.spacing,
      },
      transitionTimingFunction: {
        default: designTokens.transitions.easing.default,
        in: designTokens.transitions.easing.in,
        out: designTokens.transitions.easing.out,
      },
      transitionDuration: {
        fast: designTokens.transitions.duration.fast,
        normal: designTokens.transitions.duration.normal,
        slow: designTokens.transitions.duration.slow,
      },
    },
  },
  plugins: [],
};

export default config;
