# Design Plan — Vibrant Gradient UX Refresh

Goal: make the dashboard more colorful and fashionable without losing the tasteful,
fast baseline or breaking dark mode and accessibility. Direction chosen: **Vibrant
Gradient** (indigo to violet to fuchsia, soft colored shadows, gradient accents).

## Starting point (what already exists)

- Tailwind v4 (CSS-first config in `globals.css`), Geist Sans/Mono, class-based dark mode.
- A full accent engine in `PreferencesProvider.tsx` (5 presets, `--accent-rgb`,
  `.bg-accent`/`.text-accent`/`.ring-accent`) that is **never surfaced in the UI** and
  defaults to zinc. This is the main lever to turn on.
- Color today is status-only (red/amber/emerald/blue). Categories are flat gray pills,
  sidebar active item is a black pill, StatsBar is white-on-zinc.
- Accessibility is built in and must be preserved: `.high-contrast`,
  `prefers-reduced-motion`, `focus-visible`. Animation kit already present.

## Palette (locked)

Brand ramp:
- brand   indigo  `#6366F1`  rgb 99 102 241
- brand-2 violet  `#A855F7`  rgb 168 85 247
- brand-3 fuchsia `#EC4899`  rgb 236 72 153
- gradient-brand: `linear-gradient(135deg, #6366F1, #A855F7, #EC4899)`

Surfaces:
- light: background `#FFFFFF`, surface `#FFFFFF`, surface-elevated `#FAFAFB`, faint tint `#FBFAFF`
- dark:  background `#0A0A12`, surface `#12121C`, surface-elevated `#1A1A28`

Semantic (keep current meaning, promote to tokens):
- success `#10B981`, warn `#F59E0B`, danger `#EF4444`, info `#3B82F6`

Colored shadow (the signature "glow"):
- light: `0 8px 30px rgba(99,102,241,0.15)`
- dark:  `0 8px 30px rgba(168,85,247,0.25)`

## Accent presets (expand 5 -> 8, each a gradient pair)

Store start + end so gradients are preset-driven. Default flips from zinc to Aurora.

| name    | start (rgb)   | end (rgb)     |
|---------|---------------|---------------|
| aurora* | 99 102 241    | 236 72 153    |
| grape   | 168 85 247    | 236 72 153    |
| ocean   | 59 130 246    | 34 211 238    |
| forest  | 16 185 129    | 20 184 166    |
| sunset  | 249 115 22    | 236 72 153    |
| coral   | 244 63 94     | 249 115 22    |
| ice     | 34 211 238    | 99 102 241    |
| zinc    | 24 24 27      | 24 24 27      |  (mono escape hatch)

*default

## Phases

### Phase 0 — Turn on the engine (highest payoff, ~1 session)
- `PreferencesProvider.tsx`: change `AccentColor` set to the 8 above; store two vars
  (`--accent-rgb`, `--accent-rgb-2`); default `aurora`.
- `globals.css`: derive `--gradient-brand` from the two accent vars; add utilities
  `.text-gradient-brand`, `.bg-gradient-brand`, `.border-gradient-brand`, `.shadow-brand`,
  `.surface`, `.surface-elevated`.
- `ConfigPanel.tsx`: add a theme picker (8 swatches + font-size + high-contrast toggles,
  all already in the provider). Add a compact swatch row to the sidebar footer too.
- Immediate result: active nav, primary buttons, focus rings, links gain brand color.

### Phase 1 — Design tokens (foundation)
- `globals.css @theme`: add `--brand`, `--brand-2`, `--brand-3`, surface tokens, semantic
  tokens, `--gradient-brand`, a soft radial mesh background token, and the colored shadow.
- Dark-mode value for every token; `.high-contrast` maps brand to currentColor so it
  flattens correctly.

### Phase 2 — Signature surfaces
- `Sidebar.tsx`: active item -> brand-gradient pill with `.shadow-brand` glow (replace
  `bg-zinc-900`); section labels subtle tint; mobile tab bar active gets a brand dot;
  faint gradient tint on the sidebar background.
- `app/page.tsx`: hero band behind the title + StatsBar using the mesh gradient; title in
  `.text-gradient-brand`.
- `StatsBar.tsx`: per-stat semantic color, tiny icon, colored top-border.
- `ToolCard.tsx`: category-colored pills (Daily=sky, Research=violet, Settings=slate,
  Automation=indigo); colored status dot; tinted hover shadow; animated gradient border
  while running.
- `SnapshotPanel.tsx` + `app/action-items/page.tsx`: urgent/action/priority as filled
  gradient chips with a colored left-accent bar per source.

### Phase 3 — Fashion layer
- Typography: keep Geist for body; headings get `font-bold tracking-tight` plus
  `.text-gradient-brand` on H1s. Optional display font (Space Grotesk) behind a flag.
- Pill/badge system: one soft-fill + ring pill component reused for category/source/priority.
- Glass + gradients: glassmorphism on sticky headers and modals (extend the existing
  `backdrop-blur` use); gradient primary buttons; gradient borders on hero cards.
- Micro-interactions: color pop on "mark all done," animated gradient on the primary CTA,
  colored empty-state treatments. Reuse existing keyframes where possible.

### Phase 4 — Guardrails & verification
- WCAG AA contrast check on every colored-text-on-tinted-bg pair (main risk).
- Confirm `.high-contrast` flattens to mono, `prefers-reduced-motion` kills new motion,
  full dark-mode parity, and `npm run build` stays clean and fast.

## Effort

- Phase 0: 1 session, large visible payoff, low risk (reuses existing engine).
- Phases 1-2: 2-3 sessions (the bulk of the restyle).
- Phase 3: 1-2 sessions.
- Phase 4: ongoing, verify per page.

## Guardrails

- Do not regress the tasteful, fast baseline. Color is additive, not noise.
- Every new color needs a dark-mode value and must pass AA contrast.
- High-contrast and reduced-motion users must get the flat, calm experience unchanged.
- Watch performance: gradients and `backdrop-blur` have a cost on large lists.
