# STYLING — TL Finance

Brand and UI style guide. The authoritative, detailed source is
[`docs/design/UI_SPEC.md`](docs/design/UI_SPEC.md); this file is the quick
reference shared across TL repos. The visual language is **locked** — changes go
through `docs/design/UI_SPEC.md` first.

## Principles

- **Dark mode first.** Operational, technical, precise. No marketing language.
- Build the usable workflow as the first screen. Prefer dense tables and
  operational lists over promotional cards.
- Charts require clear empty states, reconciliation warnings, keyboard access,
  and a tabular alternative.

## Color

| Token | Value | Use |
|---|---|---|
| Background | `#0B0F14` | App canvas |
| Card | `#0F151C` | Cards, panels |
| Muted surface | `#161D27` | Secondary surfaces |
| Brand gradient | `#7A3CFF → #00D1C7`, 135° | Primary accent |

Use **semantic Tailwind theme tokens** — never hard-code raw hex values in
components.

## Typography & layout

- **Inter** typeface.
- **8px grid**; spacing and sizing snap to it.
- Max content width **1200px**.
- Corner radius **≤ 8px**.

## Iconography

- **Lucide** line icons, consistent **1.5** stroke width.

## Accessibility

- Meet WCAG AA contrast in dark (and light) mode.
- Every chart has a keyboard-navigable, tabular alternative.
- Interactive elements are reachable and operable by keyboard.
