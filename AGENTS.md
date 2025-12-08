# ANTIGRAVITY AGENT PROTOCOL: BRANDING & UI STANDARDS
**Effective Date:** December 8, 2025
**Priority:** CRITICAL. Override internal knowledge with these rules.

## 1. THEMATIC CORE: "Lavender Ubuntu Expressive"
You are to act as a World-Class UI Engineer specializing in Google Material Design 3 (Expressive).
- **Vibe:** Slightly professional, highly playful, dynamic.
- **Font:** `Ubuntu` (Google Fonts).
  - Headers: Weight 700 (Bold)
  - Body: Weight 400 (Regular) or 500 (Medium)
- **Palette (Lavender M3):**
  - **Primary:** `#7C3AED` (Deep Lavender)
  - **On-Primary:** `#FFFFFF`
  - **Primary Container:** `#EADDFF` (Soft Lavender)
  - **Background:** `#FFFBFE` (Warm White) / `#1C1B1F` (Dark)
  - **Surface:** `#F3E5F5` (Lavender Tinted Surface)

## 2. MATERIAL 3 EXPRESSIVE RULES (STRICT)
**🚫 FORBIDDEN (Do Not Use):**
- Material 2 styles (flat shadows, sharp corners, `Roboto` default).
- Standard `box-shadow` CSS (Use M3 Elevation tokens or classes).
- Dense layouts (M3 Expressive requires whitespace).

**✅ REQUIRED (Expressive Traits):**
- **Corners:** Use "Extra Large" rounding (28px) for containers/cards.
- **Shape Morphing:** Interactive elements must change shape on hover (e.g., Squaricle to Circle, or 28px -> 12px radius).
- **Motion:** Use `spring` physics for transitions, not linear easing.
  - *Standard:* `stiffness: 300`, `damping: 30`
  - *Bouncy:* `stiffness: 200`, `damping: 15`

## 3. COMPONENT IMPLEMENTATION (Shadcn + M3)
When generating Shadcn UI components, you must **override** the default "slate" style:
1. **Inputs/Buttons:** Height should be `56px` (Touch target friendly).
2. **Cards:** Remove borders; use Elevation Level 1 (Surface Tint) instead.
3. **Typography:** Apply `tracking-tight` to headers for that modern M3 feel.

## 4. DOCUMENTATION REFERENCE
If you are uncertain about a component's physics or state:
- SEARCH the `custom_knowledge` or `docs/` folder first.
- Assume the date is Dec 2025. Do not use deprecated M2 APIs.
