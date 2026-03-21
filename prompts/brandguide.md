# Colyni Brand Guide
> For use in Cursor as a design reference. Follow this guide for all UI decisions.

---

## Philosophy

Colyni should feel like infrastructure you can trust. Not flashy, not crypto-bro, not another dark-mode AI dashboard. Clean, honest, a little human. The green is intentional — it signals that compute can be sustainable and shared, not extractive. White space is confidence. If something feels cluttered, remove it.

---

## Typography

**Primary font: [Geist](https://vercel.com/font)**

Geist is Vercel's open-source typeface. It sits in the same family as the font Claude uses — geometric, legible, slightly warm, not aggressively techy. It reads honest. It doesn't try too hard. Use it for everything.

Import in your project:
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');
```

Or install via npm:
```bash
npm install geist
```

**Scale:**
```
Display:  48px / weight 600 / tracking -0.02em
H1:       32px / weight 600 / tracking -0.01em
H2:       24px / weight 500
H3:       18px / weight 500
Body:     15px / weight 400 / line-height 1.6
Small:    13px / weight 400
Label:    12px / weight 500 / tracking 0.04em / uppercase
```

**Rules:**
- Never use bold (700+) except for display headings
- Body text is always 15px, never smaller than 13px
- Labels and tags use uppercase + wide tracking
- Line height for body is always 1.6 — give text room to breathe

---

## Color

### Primary Palette

```
--color-bg:           #F9F9F8    /* Off-white, not pure white — easier on eyes */
--color-surface:      #FFFFFF    /* Cards, modals, inputs */
--color-border:       #E5E5E3    /* Subtle dividers */
--color-border-dark:  #D1D1CE    /* Stronger borders when needed */

--color-text-primary: #1A1A18    /* Near-black, not pure black */
--color-text-secondary: #6B6B67  /* Secondary labels, metadata */
--color-text-muted:   #A8A8A3    /* Disabled states, placeholders */
```

### Accent — Colyni Green

```
--color-green:        #3D8C5E    /* Primary action — buttons, active states */
--color-green-light:  #EBF5EF    /* Green tint for backgrounds, badges */
--color-green-dark:   #2D6B47    /* Hover state */
--color-green-muted:  #6AAF87    /* Icons, secondary green elements */
```

**Green is used sparingly.** It appears on: primary CTAs, active node indicators, token counters, success states. Nowhere else. If everything is green, nothing is.

### Status Colors

```
--color-error:        #C0392B
--color-error-light:  #FDECEA
--color-warning:      #D97706
--color-warning-light:#FEF3C7
```

### Dark Mode (if implemented)

```
--color-bg:           #111110
--color-surface:      #1A1A18
--color-border:       #2A2A27
--color-text-primary: #F0F0EE
--color-text-secondary: #888884
--color-green:        #4CAF72    /* Slightly lighter green on dark */
--color-green-light:  #1A2E22
```

---

## Spacing

Use an 8px base unit. Everything is a multiple of 8.

```
4px   — xs  (tight gaps, icon padding)
8px   — sm  (inline spacing)
16px  — md  (component padding)
24px  — lg  (section gaps)
32px  — xl  (card padding)
48px  — 2xl (section breaks)
64px  — 3xl (page-level spacing)
```

**Don't be afraid of 64px+ of vertical space between sections.** White space signals that each component has room to breathe and be understood on its own.

---

## Components

### Buttons

```css
/* Primary */
background: var(--color-green);
color: white;
border-radius: 6px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
border: none;

/* Hover */
background: var(--color-green-dark);

/* Secondary */
background: transparent;
color: var(--color-text-primary);
border: 1px solid var(--color-border-dark);

/* Ghost */
background: transparent;
color: var(--color-text-secondary);
border: none;
```

No gradients. No shadows on buttons. No rounded-full pill buttons unless it's a badge/tag.

### Cards

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: 10px;
padding: 24px;
```

No box shadows. Let the border do the work. Cards should feel like paper, not floating elements.

### Node Status Indicator

```css
/* Online */
width: 8px; height: 8px;
border-radius: 50%;
background: var(--color-green);
box-shadow: 0 0 0 3px var(--color-green-light);

/* Offline */
background: var(--color-border-dark);
```

### Token Counter

The token number should animate upward when earned. Use a simple counting animation — nothing flashy. Green text, monospaced number, small label underneath.

```css
font-variant-numeric: tabular-nums;
color: var(--color-green);
font-size: 32px;
font-weight: 600;
```

### Input Fields

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: 6px;
padding: 10px 14px;
font-size: 15px;
color: var(--color-text-primary);

/* Focus */
border-color: var(--color-green);
outline: none;
```

---

## Layout Rules

- Max content width: **1100px**, centered
- Page padding: **24px** on sides (mobile), **48px** (desktop)
- Never stack more than 3 cards in a row
- Navigation is minimal — logo left, 2-3 links max, one CTA button right
- Page headers have generous top padding: **64px minimum**

---

## Iconography

Use [Lucide](https://lucide.dev/) icons exclusively. They match the Geist aesthetic — clean, slightly rounded, never aggressive.

```bash
npm install lucide-react
```

Icon size: **16px** inline, **20px** standalone. Always `var(--color-text-secondary)` unless it's a status icon.

---

## Voice & Copy

- Short sentences. No fluff.
- Never say "leverage", "harness", "unlock", "revolutionize"
- Prefer active voice: *"Your node earned 12 tokens"* not *"12 tokens were earned by your node"*
- Numbers are specific: *"ran in 14.2 seconds"* not *"ran faster"*
- Error messages are honest: *"Couldn't reach the cluster. Check your network."* not *"Something went wrong."*

---

## What Colyni Is Not

- Not a crypto app — don't use coin/wallet/blockchain language in the UI
- Not an AI chatbot — the inference UI is a tool, not a conversation
- Not a dashboard for its own sake — every metric shown should mean something to the user

---

## Reference Aesthetic

Think: Linear, Vercel, Resend. Minimal, confident, every element earns its place. If you're adding something decorative, remove it.