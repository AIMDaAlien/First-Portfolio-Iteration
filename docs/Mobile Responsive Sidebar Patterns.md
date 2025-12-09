# Mobile Responsive Sidebar Patterns

Implementing a slide-out drawer for mobile navigation.

---

## The Problem

Desktop sidebars don't work on mobile:
- Take up too much horizontal space
- Can't be scrolled independently
- Not touch-friendly

---

## Solution: Slide-Out Drawer

A sidebar that slides in from the left when triggered, with an overlay backdrop.

### HTML Structure

```html
<!-- Mobile menu button (in header) -->
<button class="mobile-menu-btn" id="mobileMenuBtn">
    <span>hamburger-icon</span>
</button>

<!-- Overlay backdrop -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- Sidebar -->
<aside class="sidebar" id="sidebar">
    <!-- Content -->
</aside>
```

---

## CSS Implementation

### Mobile Menu Button

```css
.mobile-menu-btn {
    display: none; /* Hidden on desktop */
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
}
```

### Overlay Backdrop

```css
.sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 40;
    opacity: 0;
    transition: opacity 0.25s ease;
}

.sidebar-overlay.visible {
    display: block;
    opacity: 1;
}
```

### Sidebar Drawer

```css
@media (max-width: 768px) {
    .mobile-menu-btn {
        display: flex;
    }
    
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 280px;
        z-index: 50;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
    }
    
    .sidebar.open {
        transform: translateX(0);
    }
}
```

---

## JavaScript Handlers

```javascript
// Open sidebar
mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
});

// Close on overlay click
overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
});

// Auto-close on file selection
fileItem.addEventListener('click', () => {
    loadFile(file);
    closeMobileSidebar();
});
```

---

## Breakpoint Strategy

| Breakpoint | Behavior |
|------------|----------|
| Desktop (> 1024px) | Fixed sidebar, 260px wide |
| Tablet (768-1024px) | Fixed sidebar, 220px wide |
| Mobile (< 768px) | Hidden, slide-out drawer |
| Small (< 480px) | Full-width drawer |

---

## Touch Considerations

- Minimum 44px touch targets (Apple HIG)
- Sufficient contrast for overlay
- Swipe-to-close (optional enhancement)

---

## Related Notes

- [[CSS Breakpoint Strategy]]
- [[Touch-Friendly UI Design]]
- [[Spring Animation Timing]]
