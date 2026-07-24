/**
 * Design Tokens — eMDB Frontend
 * 
 * Charte graphique complète basée sur Trakt.tv avec primaire rouge.
 * Ce fichier est la source de vérité pour toutes les valeurs de design.
 * Il sera consommé par tailwind.config.js et les composants.
 * 
 * @see docs/frontend-design-choices.md pour les décisions de design
 */

// ============================================================================
// COULEURS (Palette)
// ============================================================================

export const colors = {
  // Primary — Rouge eMDB (Trakt.tv violet → rouge)
  primary: {
    DEFAULT: '#e50914', // Rouge principal (boutons, liens, accents)
    hover: '#ff1a25',   // Hover state (+11% lightness)
    active: '#b2070f',  // Active state (-15% lightness)
    light: '#ff4d58',   // Variante claire (gradients, highlights)
    dark: '#c40711',    // Variante foncée
    subtle: 'rgba(229, 9, 20, 0.1)', // 10% opacity pour backgrounds
  },

  // Secondary — Gris bleuté neutre
  secondary: {
    DEFAULT: '#2a2a2a', // Dark mode surface
    light: '#f5f5f5',   // Light mode surface
    hover: '#3a3a3a',   // Dark mode hover
    hoverLight: '#e8e8e8', // Light mode hover
  },

  // Accent — Jaune/Or pour ratings et highlights
  accent: {
    DEFAULT: '#ffc107', // Étoiles ratings, highlights
    hover: '#ffcd38',
    dark: '#e0a800',
    subtle: 'rgba(255, 193, 7, 0.15)',
  },

  // Semantic colors
  success: {
    DEFAULT: '#4caf50', // Vu, validé, succès
    hover: '#66bb6a',
    subtle: 'rgba(76, 175, 80, 0.15)',
  },

  warning: {
    DEFAULT: '#ff9800', // En cours, notifications
    hover: '#ffb74d',
    subtle: 'rgba(255, 152, 0, 0.15)',
  },

  danger: {
    DEFAULT: '#d32f2f', // Suppression, erreur
    hover: '#f44336',
    subtle: 'rgba(211, 47, 47, 0.15)',
  },

  // Text colors
  text: {
    primary: {
      DEFAULT: '#ffffff', // Dark mode
      light: '#1a1a1a',   // Light mode
    },
    secondary: {
      DEFAULT: '#b0b0b0', // Dark mode
      light: '#666666',   // Light mode
    },
    muted: {
      DEFAULT: '#808080', // Dark mode (placeholder, disabled)
      light: '#999999',   // Light mode
    },
    inverse: '#ffffff', // Texte sur backgrounds colorés
  },

  // Backgrounds
  background: {
    DEFAULT: '#141414', // Dark mode principal
    light: '#fafafa',   // Light mode principal
    elevated: '#1a1a1a', // Dark mode (éléments au-dessus)
    elevatedLight: '#ffffff', // Light mode
  },

  // Surface/Card backgrounds
  surface: {
    DEFAULT: '#1f1f1f', // Dark mode cards
    light: '#ffffff',   // Light mode cards
    hover: '#2a2a2a',   // Dark mode card hover
    hoverLight: '#f5f5f5', // Light mode card hover
  },

  // Borders
  border: {
    DEFAULT: '#333333', // Dark mode
    light: '#e0e0e0',   // Light mode
    focus: '#e50914',   // Focus ring color
  },

  // Overlay (modals, dropdowns)
  overlay: {
    DEFAULT: 'rgba(0, 0, 0, 0.7)', // Dark backdrop
    light: 'rgba(0, 0, 0, 0.5)',   // Light backdrop
  },
} as const;

// ============================================================================
// TYPOGRAPHIE
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
  },

  // Font sizes (rem → px)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },

  // Font weights
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,   // Headings
    normal: 1.5,  // Body text
    relaxed: 1.75, // Long-form text
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.02em', // Headings
    normal: '0',      // Body
    wide: '0.05em',   // Uppercase labels
  },
} as const;

// ============================================================================
// SPACING (Base 4px)
// ============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',  // 2px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',  // Cercles (avatars, badges)
} as const;

// ============================================================================
// ELEVATIONS (Shadows)
// ============================================================================

export const shadows = {
  // Sur dark mode, préférer des bordures subtiles
  sm: {
    DEFAULT: '0 1px 2px rgba(0, 0, 0, 0.3)',
    dark: 'none', // Utiliser border à la place
  },
  md: {
    DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.4)',
    dark: 'none',
  },
  lg: {
    DEFAULT: '0 10px 15px rgba(0, 0, 0, 0.5)',
    dark: 'none',
  },
  xl: {
    DEFAULT: '0 20px 25px rgba(0, 0, 0, 0.6)',
    dark: 'none',
  },
} as const;

// ============================================================================
// BREAKPOINTS (responsive)
// ============================================================================

export const breakpoints = {
  sm: '640px',   // Mobile landscape / phablet
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / desktop
  xl: '1280px',  // Wide desktop
  '2xl': '1536px', // Ultra-wide
} as const;

// ============================================================================
// TRANSITIONS & ANIMATIONS
// ============================================================================

export const transitions = {
  // Durées standard
  duration: {
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Timing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)', // ease-in-out
    in: 'cubic-bezier(0.4, 0, 1, 1)',        // ease-in
    out: 'cubic-bezier(0, 0, 0.2, 1)',       // ease-out
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Spring-like
  },

  // Presets pour composants communs
  preset: {
    button: 'all 100ms cubic-bezier(0.4, 0, 0.2, 1)',
    card: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    modal: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    page: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    toast: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ============================================================================
// Z-INDEX LAYERS
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
} as const;

// ============================================================================
// RATINGS (Système de notation)
// ============================================================================

export const ratings = {
  // Échelle
  scale: {
    min: 0,
    max: 10,
    step: 0.5, // Demi-étoiles
  },

  // Étoiles (1 étoile pleine = 2 points)
  stars: {
    count: 5,
    pointsPerStar: 2,
  },

  // Couleurs
  colors: {
    filled: '#ffc107',      // Étoile remplie (jaune)
    empty: '#4a4a4a',       // Dark mode
    emptyLight: '#d0d0d0',  // Light mode
    half: '#ffc107',        // Demi-étoile (même couleur avec clip-path)
  },

  // Tailles
  sizes: {
    sm: '1rem',    // 16px
    md: '1.5rem',  // 24px
    lg: '2rem',    // 32px
    xl: '2.5rem',  // 40px
  },
} as const;

// ============================================================================
// WATCH STATES (Marquage vu/non-vu)
// ============================================================================

export const watchStates = {
  // Couleurs des états
  colors: {
    watched: '#4caf50',    // Vert = vu
    watching: '#2196f3',   // Bleu = en cours
    unwatched: '#808080',  // Gris = non vu
  },

  // Badge "Vu"
  badge: {
    backgroundColor: '#4caf50',
    textColor: '#ffffff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },

  // Check overlay (sur affiche épisode)
  checkOverlay: {
    size: '2rem',          // Diamètre du cercle
    backgroundColor: '#4caf50',
    iconColor: '#ffffff',
    position: 'top-right',
    offset: '8px',
  },
} as const;

// ============================================================================
// CARDS (TitleCard, PersonCard)
// ============================================================================

export const cards = {
  // TitleCard (poster mode 2:3)
  title: {
    aspectRatio: '2/3',       // Ratio affiche
    borderRadius: '6px',
    hover: {
      scale: 1.05,
      shadow: '0 10px 15px rgba(0, 0, 0, 0.5)',
      transition: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    overlay: {
      height: '33%',          // 1/3 en bas pour le titre + note
      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
      padding: '12px',
    },
    badge: {
      position: 'top-left',
      offset: '8px',
      backgroundColor: '#e50914',
      textColor: '#ffffff',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
    },
  },

  // PersonCard
  person: {
    aspectRatio: '1/1',       // Portrait carré
    borderRadius: '8px',
    hover: {
      scale: 1.03,
      shadow: '0 8px 12px rgba(0, 0, 0, 0.4)',
      transition: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  // Grid layout
  grid: {
    desktop: {
      columns: 6,
      gap: '1.5rem',  // 24px
    },
    tablet: {
      columns: 3,
      gap: '1rem',    // 16px
    },
    mobile: {
      columns: 2,
      gap: '0.75rem', // 12px
    },
  },
} as const;

// ============================================================================
// LAYOUT
// ============================================================================

export const layout = {
  // Max widths
  maxWidth: {
    content: '1280px', // Contenu principal
    wide: '1536px',    // Contenu large (dataviz)
  },

  // Header
  header: {
    height: '4rem',    // 64px
    backgroundColor: '#141414',
    borderBottom: '1px solid #333333',
  },

  // Sidebar
  sidebar: {
    width: '16rem',    // 256px
    collapsedWidth: '4rem', // 64px (icons only)
    backgroundColor: '#1a1a1a',
  },

  // Page padding
  pagePadding: {
    mobile: '1rem',    // 16px
    desktop: '1.5rem', // 24px
  },
} as const;

// ============================================================================
// EMPTY STATES
// ============================================================================

export const emptyStates = {
  textColor: '#666666',
  iconSize: '4rem',    // 64px
  ctaButton: {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
  },
} as const;

// ============================================================================
// DARK MODE
// ============================================================================

export const darkMode = {
  default: true,         // Dark mode par défaut
  transitions: {
    duration: '200ms',
    easing: 'ease-in-out',
  },
} as const;

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const accessibility = {
  // Focus visible
  focus: {
    width: '2px',
    style: 'solid',
    color: '#e50914',
    offset: '2px',
  },

  // Touch targets (mobile)
  touchTarget: {
    minWidth: '44px',
    minHeight: '44px',
  },

  // Contrast ratios (WCAG 2.1 AA)
  contrastRatio: {
    normal: 4.5,   // Texte normal
    large: 3.0,    // Texte large (≥18px)
  },
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type Breakpoints = typeof breakpoints;
export type Transitions = typeof transitions;
export type ZIndex = typeof zIndex;
export type Ratings = typeof ratings;
export type WatchStates = typeof watchStates;
export type Cards = typeof cards;
export type Layout = typeof layout;
export type EmptyStates = typeof emptyStates;
export type DarkMode = typeof darkMode;
export type Accessibility = typeof accessibility;

// ============================================================================
// EXPORT GLOBAL (pour usage dans tailwind.config.js)
// ============================================================================

export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  breakpoints,
  transitions,
  zIndex,
  ratings,
  watchStates,
  cards,
  layout,
  emptyStates,
  darkMode,
  accessibility,
} as const;

export type DesignTokens = typeof designTokens;