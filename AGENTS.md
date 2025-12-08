# M3 EXPRESSIVE WEB SPECIFICATION (STRICT)
**Version:** 2.0 (Dec 2025)
**Scope:** Global UI, Motion, & Interaction
**Enforcement:** CRITICAL. Override all default Material 2/3 assumptions.

---

## 1. THE SYSTEM ARCHITECTURE (Root Variables)
*The default M3 radius is 12px. We reject this. Expressive is 28px.*

Define these variables in your root CSS file (`layout.tsx` or `globals.css`).

### A. The Lavender HCT Palette (Computed)
*Based on Seed Color: #7C3AED (Deep Lavender)*
```css
:root {
  /* Core Roles */
  --md-sys-color-primary: #7C3AED;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-on-primary-container: #21005D;

  /* Surface System (Tinted) */
  --md-sys-color-surface: #FFFBFE;
  --md-sys-color-surface-dim: #DED8E1; /* Low prominence */
  --md-sys-color-surface-bright: #FFFBFE; /* High prominence */
  --md-sys-color-surface-container-lowest: #FFFFFF;
  --md-sys-color-surface-container-low: #F7F2FA;
  --md-sys-color-surface-container: #F3E5F5; /* Main Background */
  --md-sys-color-surface-container-high: #ECE6F0;
  --md-sys-color-surface-container-highest: #E6E0E9;
  
  /* Text & Icons */
  --md-sys-color-on-surface: #1C1B1F;
  --md-sys-color-on-surface-variant: #49454F;
  --md-sys-color-outline: #79747E;
  --md-sys-color-outline-variant: #CAC4D0;
}
```

### B. The Shape System (Squaricle Enforcement)

*Standard M3 uses "Small/Medium/Large". Expressive scales everything up.*

```css
:root {
  /* System Overrides */
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 16px;
  --md-sys-shape-corner-large: 24px;
  --md-sys-shape-corner-extra-large: 28px; /* The "Expressive" Standard */
  --md-sys-shape-corner-full: 9999px;
  
  /* Global Component Defaults */
  --md-card-container-shape: var(--md-sys-shape-corner-extra-large);
  --md-dialog-container-shape: var(--md-sys-shape-corner-extra-large);
  --md-list-container-shape: var(--md-sys-shape-corner-medium);
}
```

---

## 2. MOTION PHYSICS (The "Spring" Engine)

*Standard easing (`cubic-bezier`) is forbidden for interactions. Use these calculated Linear Spring strings.*

### Token: `--motion-spring-bouncy`

**Use for:** Hover states, FABs, Switch toggles, Icon Button presses.
**Physics:** Stiffness 200, Damping 15.

```css
--motion-spring-bouncy: linear(
  0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.074 20.8%, 
  1.137 25.2%, 1.146 29.8%, 1.119 34.8%, 1.077 40.1%, 1.036 45.9%, 
  1.007 52.3%, 0.991 59.8%, 0.996 76%, 1 100%
);
```

### Token: `--motion-spring-expressive`

**Use for:** Large containers entering (Modals, Side sheets), Page transitions.
**Physics:** Stiffness 300, Damping 30.

```css
--motion-spring-expressive: linear(
  0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 15.2%, 0.719 19.6%, 0.849 24.3%, 
  0.937 29.2%, 0.986 34.3%, 1.006 39.7%, 1.008 45.4%, 1.001 51.5%, 
  0.999 57.8%, 1 100%
);
```

### Token: `--motion-morph`

**Use for:** `border-radius` changes (Square -> Circle).
**Duration:** 500ms always.

```css
--motion-morph: linear(0, 0.005, 0.02 2.2%, 0.65 14.8%, 0.85 20.8%, 1 100%);
```

---

## 3. TYPOGRAPHY (Ubuntu Override)

*M3 Expressive requires tighter tracking on Display fonts to avoid "falling apart."*

```css
:root {
  --md-ref-typeface-brand: 'Ubuntu', sans-serif;
  --md-ref-typeface-plain: 'Ubuntu', sans-serif;
  
  /* Display Large (Hero Text) */
  --md-sys-typescale-display-large-font: 'Ubuntu';
  --md-sys-typescale-display-large-weight: 700;
  --md-sys-typescale-display-large-size: 57px;
  --md-sys-typescale-display-large-line-height: 64px;
  --md-sys-typescale-display-large-tracking: -0.25px;

  /* Headline Large (Section Headers) */
  --md-sys-typescale-headline-large-font: 'Ubuntu';
  --md-sys-typescale-headline-large-weight: 500;
  --md-sys-typescale-headline-large-size: 32px;
  --md-sys-typescale-headline-large-line-height: 40px;
  --md-sys-typescale-headline-large-tracking: 0px;
}
```

---

## 4. COMPONENT IMPLEMENTATION GUIDE (Shadcn + M3)

### A. The Card (M3 Elevated)

*Remove borders. Use Surface Tint.*

- **Class:** `bg-surface-container-low hover:bg-surface-container-high transition-colors duration-300`
- **Shape:** `rounded-[28px]`
- **Elevation:** Do not use shadow. Use Color Tint opacity.

### B. The "Squaricle" Button

*Standard buttons are pills. Expressive buttons can be large rounded rectangles.*

- **CSS Variable Override:**
  ```css
  md-filled-button {
    --md-filled-button-container-shape: 16px; /* Not 999px */
    --md-filled-button-container-height: 56px; /* Taller target */
    --md-filled-button-label-text-font: 'Ubuntu';
    --md-filled-button-label-text-weight: 500;
  }
  ```

### C. The Navigation Rail (Expressive)

*Do not use a bottom tab bar for desktop. Use a floating rail.*

- **Position:** Fixed left, vertically centered.
- **Container:** Floating pill shape (`rounded-full`), not full height.
- **Item Active Indicator:**
  ```css
  --md-navigation-rail-indicator-shape: 16px; /* Squaricle match */
  --md-navigation-rail-indicator-color: var(--md-sys-color-primary-container);
  ```

---

## 5. LAYOUT PATTERNS (The "Masonry")

*Do not use uniform grids. Expressive design embraces variable aspect ratios.*

**The "Staggered" Rule:**
When displaying a collection of items (Cards, Images), verify if `grid-template-rows: masonry` is supported.
If NOT, use a 3-column grid where items span row-heights randomly:

```tsx
// Tailwind Pattern
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card className="row-span-2" /> {/* Tall Item */}
  <Card className="row-span-1" /> {/* Standard Item */}
  <Card className="col-span-2" /> {/* Wide Item */}
</div>
```

---

## 6. INTERACTION PROTOCOLS

1. **The "Squeeze":** When a user clicks a button, scale it to `0.95` using `--motion-spring-bouncy`.
2. **The "Lift":** When a user hovers a card, scale it to `1.02` and increase Surface Tint brightness.
3. **The "Morph":** If a user selects an item, animate the container's `border-radius` from `28px` to `4px` (or `0px` if going full screen).

---

## 7. FORBIDDEN PATTERNS

🚫 **DO NOT USE:**
- Material 2 styles (flat shadows, sharp corners, `Roboto` default)
- Standard `box-shadow` CSS (Use M3 Elevation tokens or surface tint)
- Dense layouts (M3 Expressive requires whitespace)
- `cubic-bezier` for interactive animations (Use `linear()` springs)
- Default 12px border-radius (Expressive is 28px)
- Bottom tab bars on desktop (Use floating navigation rail)

---

## 8. PROMPT TEMPLATE

When coding with this specification, use this prompt structure:

> "Initialize the project using the **Strict M3 Expressive Spec**. I want the `layout.tsx` to include the root CSS variables for the Lavender/Ubuntu theme defined in the knowledge file. Create a `Button` component that uses the `linear()` spring physics for its hover state."

This gives the agent **no wiggle room**. It cannot "invent" a shadow because the spec says "Elevation: Use Color Tint." It cannot use Roboto because the root variable is hardcoded to Ubuntu.
