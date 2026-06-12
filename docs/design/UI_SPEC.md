# UI Specification

TL Finance uses a dark, dense, operational interface.

## Tokens

| Token | Value |
| --- | --- |
| background | `#0B0F14` |
| card | `#0F151C` |
| muted surface | `#161D27` |
| brand violet | `#7A3CFF` |
| brand teal | `#00D1C7` |

The brand gradient runs at 135 degrees. Components use semantic Tailwind tokens,
not raw color values. Layout follows an 8px grid with a maximum width of
1200px. Radius is at most 8px. Inter is the preferred typeface.

Tables and operational lists take priority over promotional cards. Money-flow
visualizations must provide empty and reconciliation states, keyboard-accessible
controls, and a tabular alternative. Color is never the only status signal.
Income sources, category totals, and budget items are ordered by normalized
monthly value from top to bottom. Route colors identify the income source or
outflow category within a semantic family; internal transfers use a dashed route
in addition to their distinct color. The graph displays monthly values on nodes,
labels visual stages, and keeps focused filters connected from upstream source
through downstream use.
