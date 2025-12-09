# CSS Breakpoint Strategy

A systematic approach to responsive design using three breakpoints.

---

## The Three-Breakpoint System

| Name | Max-Width | Target |
|------|-----------|--------|
| Tablet | 1024px | iPad, small laptops |
| Mobile | 768px | Phones landscape, small tablets |
| Small | 480px | Phones portrait |

---

## CSS Structure

Use mobile-first or desktop-first consistently. This example uses **desktop-first**:

```css
/* Desktop (default) */
.sidebar {
    width: 260px;
    position: relative;
}

/* Tablet */
@media (max-width: 1024px) {
    .sidebar {
        width: 220px;
    }
}

/* Mobile */
@media (max-width: 768px) {
    .sidebar {
        width: 280px;
        position: fixed;
        transform: translateX(-100%);
    }
}

/* Small Mobile */
@media (max-width: 480px) {
    .sidebar {
        width: 100%;
    }
}
```

---

## Common Adjustments by Breakpoint

### Typography

```css
/* Desktop */
h1 { font-size: 2.5rem; }

/* Mobile */
@media (max-width: 768px) {
    h1 { font-size: 1.75rem; }
}

/* Small */
@media (max-width: 480px) {
    h1 { font-size: 1.5rem; }
}
```

### Grid Layouts

```css
/* Desktop: 3 columns */
.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
}

/* Tablet: 2 columns */
@media (max-width: 1024px) {
    .grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
}

/* Mobile: 1 column */
@media (max-width: 768px) {
    .grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }
}
```

### Spacing

```css
:root {
    --content-padding: 40px;
}

@media (max-width: 768px) {
    :root {
        --content-padding: 16px;
    }
}

@media (max-width: 480px) {
    :root {
        --content-padding: 12px;
    }
}
```

---

## Touch Target Sizes

Apple Human Interface Guidelines recommend minimum 44px touch targets:

```css
@media (max-width: 480px) {
    .tree-item {
        padding: 12px 16px;
        min-height: 44px;
    }
    
    button {
        min-height: 44px;
        min-width: 44px;
    }
}
```

---

## Hiding Elements

```css
/* Hide on mobile */
@media (max-width: 768px) {
    .desktop-only {
        display: none;
    }
}

/* Show only on mobile */
.mobile-only {
    display: none;
}

@media (max-width: 768px) {
    .mobile-only {
        display: block;
    }
}
```

---

## Testing Checklist

- [ ] Desktop (1440px+)
- [ ] Laptop (1024-1440px)
- [ ] Tablet landscape (768-1024px)
- [ ] Tablet portrait (600-768px)
- [ ] Mobile landscape (480-600px)
- [ ] Mobile portrait (320-480px)

---

## CSS Custom Properties for Breakpoints

```css
:root {
    --sidebar-width: 260px;
}

@media (max-width: 1024px) {
    :root {
        --sidebar-width: 220px;
    }
}

.sidebar {
    width: var(--sidebar-width);
}
```

---

## Related Notes

- [[Mobile Responsive Sidebar Patterns]]
- [[Touch-Friendly UI Design]]
- [[Fluid Typography with Clamp]]
