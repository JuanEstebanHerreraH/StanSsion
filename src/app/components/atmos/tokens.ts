// CSS variables are set by App.tsx on theme/accent changes.
// All colors reference CSS custom properties with dark-mode fallbacks.
export const t = {
  bg:            "var(--stanssion-bg, #0a0a0f)",
  surface:       "var(--stanssion-surface, rgba(255,255,255,0.04))",
  surfaceHover:  "var(--stanssion-surface-hover, rgba(255,255,255,0.07))",
  border:        "var(--stanssion-border, rgba(255,255,255,0.08))",
  borderHover:   "var(--stanssion-border-hover, rgba(255,255,255,0.14))",
  textPrimary:   "var(--stanssion-text-primary, #e8e8f0)",
  textSecondary: "var(--stanssion-text-secondary, #8888a0)",
  accent:        "var(--stanssion-accent, #4f8ef7)",
  // Static — not affected by theme
  accentPurple:  "#7c5cbf",
  success:       "#3ecf8e",
  warning:       "#f5a623",
  glass:         "rgba(255,255,255,0.05)",
  glassBlur:     "blur(12px)",
  radius:        "12px",
  radiusInput:   "8px",
  radiusBtn:     "6px",
} as const;

export const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;
export const ui   = { fontFamily: "'Inter', sans-serif" } as const;
