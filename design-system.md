# FurniTrade Design System

A calm, professional design system for B2B wholesale SaaS.

---

## Color Palette

### Core Colors (CSS Variables)

| Token           | Value                      | Usage                          |
|-----------------|----------------------------|--------------------------------|
| `--base`        | `#F7F7F8`                  | Page background                |
| `--ink`         | `#2F243A`                  | Primary text, headlines        |
| `--accent`      | `#444054`                  | CTA buttons, badges            |
| `--surface`     | `#FFFFFF`                  | Cards, modals, inputs          |
| `--surface-soft`| `rgba(255,255,255,0.7)`    | Blurred overlays, sections     |

### Derived Opacities

| Token           | Value                      | Usage                          |
|-----------------|----------------------------|--------------------------------|
| `--ink-70`      | `rgba(47,36,58,0.72)`      | Body text, secondary text      |
| `--ink-55`      | `rgba(47,36,58,0.55)`      | Muted text, captions           |
| `--ink-12`      | `rgba(47,36,58,0.12)`      | Borders, dividers              |
| `--ink-08`      | `rgba(47,36,58,0.08)`      | Subtle lines, connectors       |
| `--accent-soft` | `rgba(68,64,84,0.12)`      | Badge backgrounds, hover states|

### Status Colors (Use Sparingly)

| Token           | Value                      | Usage                          |
|-----------------|----------------------------|--------------------------------|
| `--status-live` | `#4ade80`                  | Live indicators only           |

---

## Typography

### Scale

| Token     | Mobile          | Desktop         | Weight    | Tracking      |
|-----------|-----------------|-----------------|-----------|---------------|
| `h1`      | `text-4xl`      | `text-6xl`      | 600       | tight         |
| `h2`      | `text-3xl`      | `text-4xl`      | 600       | tight         |
| `h3`      | `text-xl`       | `text-2xl`      | 600       | normal        |
| `body`    | `text-base`     | `text-lg`       | 400       | normal        |
| `bodySm`  | `text-sm`       | `text-sm`       | 400       | normal        |
| `caption` | `text-xs`       | `text-xs`       | 500       | normal        |
| `eyebrow` | `text-xs`       | `text-xs`       | 600       | `0.28em`      |
| `label`   | `text-sm`       | `text-sm`       | 600       | normal        |
| `micro`   | `10px`          | `11px`          | 500       | normal        |

### Font Family

- **Primary**: System font stack (Inter preferred if available)
- **Mono**: For code/data displays only

---

## Spacing

### Section Padding

| Token         | Mobile      | Desktop     | Usage                    |
|---------------|-------------|-------------|--------------------------|
| `section`     | `py-20`     | `py-28`     | Standard sections        |
| `sectionTight`| `py-12`     | `py-16`     | Compact sections (logos) |
| `heroSection` | `py-14`     | `py-20`     | Hero section             |

### Component Spacing

| Token   | Value       | Usage                              |
|---------|-------------|------------------------------------|
| `xs`    | `4px`       | Inline icon gaps                   |
| `sm`    | `8px`       | Tight element spacing              |
| `md`    | `12px`      | Standard component padding         |
| `lg`    | `16px`      | Card padding, section gaps         |
| `xl`    | `24px`      | Large gaps between groups          |
| `2xl`   | `32px`      | Section spacing                    |

### Container

```
max-width: 72rem (1152px)
padding-x: 1rem (mobile) / 1.5rem (desktop)
```

---

## Border Radius

| Token   | Value         | Usage                              |
|---------|---------------|------------------------------------|
| `sm`    | `rounded-xl`  | Buttons, icons, small cards        |
| `md`    | `rounded-2xl` | Cards, modals                      |
| `lg`    | `rounded-3xl` | Hero images, feature cards         |
| `pill`  | `rounded-full`| Badges, pills, tags                |

---

## Shadows

| Token         | Value                                           | Usage                    |
|---------------|-------------------------------------------------|--------------------------|
| `card`        | `0 18px 40px -32px rgba(47,36,58,0.45)`         | Default card elevation   |
| `cardStrong`  | `0 32px 64px -24px rgba(47,36,58,0.4)`          | Hero screenshot, focus   |
| `cardHover`   | `0 22px 48px -34px rgba(47,36,58,0.5)`          | Card hover state         |
| `pill`        | `0 4px 12px -4px rgba(47,36,58,0.18)`           | Floating pills/chips     |
| `subtle`      | `0 2px 8px -2px rgba(47,36,58,0.1)`             | Minimal elevation        |

---

## Components

### Buttons

**Primary CTA**
- Background: `var(--accent)`
- Text: `var(--base)`
- Border: none
- Size: `lg` for hero, `default` elsewhere

**Secondary/Outline**
- Background: transparent
- Text: `var(--ink)`
- Border: `1px solid var(--ink-12)`
- Hover: `var(--surface)`

**Ghost**
- Background: transparent
- Text: `var(--ink-55)`
- Hover: `var(--ink)`

### Cards

```tsx
className={`
  ${theme.radius.md}
  ${theme.shadow.card}
  ${theme.colors.surface}
  border ${theme.colors.border}
  p-6
`}
```

### Badges/Pills

```tsx
className={`
  ${theme.radius.pill}
  ${theme.colors.accentSoft}
  ${theme.text.caption}
  px-3 py-1
`}
```

### Screenshot Frame (Hero)

```tsx
className={`
  ${theme.radius.lg}
  border-2 border-[color:var(--ink-12)]
  ${theme.colors.surface}
  overflow-hidden
  shadow-[0_32px_64px_-24px_rgba(47,36,58,0.4)]
`}
```

---

## Layout Patterns

### Hero Grid

```
Desktop: grid-cols-[0.85fr_1.15fr]
Gap: 12 (lg:gap-12)
Screenshot scale: 110%
```

### Feature Grid

```
Mobile: 1 column
Tablet: 2 columns
Desktop: 3 columns
Gap: 6 (gap-6)
```

### Alternating Sections

```
Even index: Image right
Odd index: Image left (lg:order-2)
```

---

## Animation

### Transitions

| Property        | Duration  | Easing           |
|-----------------|-----------|------------------|
| Color/opacity   | `300ms`   | ease-out         |
| Transform       | `300ms`   | ease-out         |
| Shadow          | `200ms`   | ease-out         |

### Hover States

- Cards: `hover:-translate-y-1` + stronger shadow
- Links: color transition only
- Buttons: background transition

### Live Indicator

```tsx
className="animate-pulse"
// Used only for "Live data" status badge
```

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text
- Focus states: Use browser default or subtle ring
- Touch targets: Minimum 44x44px
- Reduced motion: Respect `prefers-reduced-motion`

---

## Don'ts

- ❌ Do NOT introduce new accent colors
- ❌ Do NOT use gradients (except subtle radial bg)
- ❌ Do NOT add decorative blobs or shapes
- ❌ Do NOT crop or recolor product screenshots
- ❌ Do NOT use flashy animations
- ❌ Do NOT deviate from the neutral palette

---

## Implementation

All tokens should be centralized in a `theme` object at the top of components:

```tsx
const theme = {
  container: "mx-auto max-w-6xl px-4 md:px-6",
  section: "py-20 md:py-28",
  // ... etc
};
```

Use CSS custom properties for colors to enable future theming.
