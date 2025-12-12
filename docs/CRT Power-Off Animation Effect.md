# CRT Power-Off Animation Effect

A CSS animation technique that mimics the classic cathode-ray tube (CRT) television turning off, creating a nostalgic retro effect for web transitions.

## How It Works

The effect simulates the physics of a CRT monitor losing power:
1. **Initial flash** - Phosphors briefly brighten
2. **Horizontal squash** - Image collapses to a horizontal line
3. **Line shrinks** - The bright line contracts to a dot
4. **Dot fades** - Final glow disappears

## CSS Implementation

```css
@keyframes crtTurnOff {
    0% {
        transform: scale(1, 1);
        opacity: 1;
        filter: brightness(1) saturate(1);
    }
    10% {
        filter: brightness(1.5) saturate(1.2); /* Initial flash */
    }
    30% {
        transform: scale(1.1, 0.8); /* Slight horizontal stretch */
        filter: brightness(1.8) saturate(0.5);
    }
    50% {
        transform: scale(1.3, 0.01); /* Squash to horizontal line */
        filter: brightness(3); /* Bright phosphor line */
    }
    70% {
        transform: scale(0.8, 0.01); /* Line shrinks */
        filter: brightness(2.5);
    }
    85% {
        transform: scale(0.01, 0.01); /* Dot */
        filter: brightness(2);
        opacity: 1;
    }
    100% {
        transform: scale(0, 0);
        opacity: 0;
        filter: brightness(0);
    }
}

.crt-off {
    animation: crtTurnOff 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
    transform-origin: center center;
    transition: none !important; /* Override existing transitions */
    opacity: 1 !important;
    background-color: #0d0d0d;
}
```

## JavaScript Trigger

```javascript
element.classList.add('crt-off');

// Wait for animation to finish before removing element
setTimeout(() => {
    element.style.display = 'none';
}, 900); // Match animation duration + buffer
```

## Key Considerations

- **Transition override**: Use `transition: none !important;` to prevent CSS transitions from interfering with the animation.
- **Opacity enforcement**: Set `opacity: 1 !important;` if the element starts with low opacity.
- **Transform origin**: Use `center center` for symmetrical collapse.
- **Timing function**: `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design easing) gives smooth acceleration.

## Use Cases

- Splash screens / loading screens
- Page transitions
- Modal dismissals
- Thematic retro/tech websites

## Related

- [[CSS Animations]]
- [[Web Transitions]]
- [[Retro UI Design]]

---

*Implemented in: First Portfolio Iteration (startup sequence)*
