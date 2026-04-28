# UX Design Guidelines

## Visual Identity

### Neobrutalist Foundation

- **Shadows**: Hard, no blur — `shadow-[3px_3px_0px_0px_black]`. Theme variable: `--shadow: 4px 4px 0px 0px var(--border)`, utility: `shadow-shadow`.
- **Borders**: `border-2` default, color `border-border` or `border-black`. Radius: `rounded-base` (5px).
- **Background**: Light mode `oklch(93.46% 0.0305 255.11)` (soft blue-gray), dark mode `oklch(29.23% 0.0626 270.49)`.
- **Cards**: `bg-secondary-background` (white light, near-black dark), `border-2`, `shadow-shadow`.
- **Primary action color**: `#F59E0B` (amber/yellow) — buttons, active tabs, hover highlights.

### Typography

- **Sans-serif (Archivo)**: `--font-sans`, all UI and headings. Utility: `font-sans`.
- **Monospace (Atkinson Hyperlegible Mono)**: `--font-mono`, code, URLs, domains.
- **Serif (Quando)**: `--font-serif`, content/prose blocks.
- **Font weight utilities**: `font-base` (500), `font-heading` (700).
- **Page title**: `font-heading text-3xl`.

## Page Layout

### Structure

Every page follows this pattern:

```
<Main variant="wide">
  <SitePageHeader site={site} title="...">
    {/* optional action buttons */}
  </SitePageHeader>
  {/* optional DateRangeSelector */}
  <section className="space-y-6">
    {/* Card-based content sections */}
  </section>
</Main>
```

- `Main` variants: `default` (centered narrow), `wide` (max-w-5xl, px-6 py-12), `prose` (prose-lg, centered, large padding).
- Route handle `{ siteNav: true }` adds nav links to header. `{ hideHeader: true }` hides page header.
- Auth pages use `hideLayout` on the root route to suppress nav entirely.

### Navigation

- Site nav links hidden on mobile (`hidden md:flex`). Mobile: logo + AccountMenu only.
- Active nav link: `text-[#F59E0B]` color.
- Footer stacks on mobile, `sm:flex-row` on larger screens.

## Loading States

- **Page loading**: `PageLoadingBouncer` — three bouncing dots (yellow, green, blue) staggered at 0s/0.2s/0.4s. Full-screen white overlay at 20% opacity. Add to every page with async data or tabs.
- **Button loading**: Disable button, show spinner icon (refresh icon gets `animate-spin`, or `Loader2Icon`).
- **Copy button**: Show "Copied!" with check icon for 2s, then revert.
- **Scanning/process**: Live log viewer (`<pre>` with auto-scroll), polls status endpoint every 1s.
- **Empty states**: Centered text, muted color, descriptive message. Use Card with `variant="yellow"` and CTA button for actionable empty states.

## Animations

| Element | Pattern | Duration |
|---|---|---|
| Button hover | translate -2px -2px, shadow 3→5px | 100ms |
| Button active | translate +2px +2px, shadow 5→1px | 100ms |
| Dialog open/close | opacity 0→1, scale 95→100 | 200ms |
| Card fade-in | `fade-in-0 zoom-in-95 animate-in` | 300ms |
| Gauge score | Custom rAF arc animation 0→target | 500ms |
| Progress bar width | `transition-width` | 500ms |
| Bouncing dots | Custom keyframe `brutalist-spin-16` | N/A |

## Forms

### Structure

- `<fetcher.Form method="POST">` for non-navigating submits.
- Hidden `_intent` field for action routing on the server.
- Use `FieldSet` / `Field` / `FieldLabel` / `FieldContent` / `FieldError` composition.
- Server actions return `{ ok: true }` or `{ ok: false, error: string }`.
- Client: `useFetcher<typeof action>()` for typed `.data`.

### Submit Buttons

- Disabled during loading, optional spinner/loading text.
- Show success/error from `fetcher.data` or `actionData` after submit.

### Input Fields

- Neobrutalist: `border-black`, `shadow-[2px_2px_0px_0px_black]`.
- Focus: translate -2px -2px, shadow `[4px_4px_0px_0px_black]`.
- Variants: `default`, `ghost` (transparent, no shadow).

## Modals / Dialogs

- Use `Dialog` component wrapping `@base-ui/react/dialog`.
- Trigger wraps a `Button`. Content: `max-h-[80vh] overflow-y-auto`.
- Header with title + description. Footer with actions.
- Responsive: `max-w-[calc(100%-2rem)]`, `sm:max-w-lg`.

## Data Display

### Tables

- Scroll horizontally on overflow (`<div className="overflow-auto">`).
- Sub-components: Table, TableHeader, TableBody, TableRow, TableHead, TableCell.
- Row hover: `hover:bg-muted/50`.

### Charts

- Use `Chart` component wrapping Recharts.
- Theme-aware via CSS variables (`--color-*`).
- Tooltip indicators: dot, line, or dashed.

### Badges

- Variants: `default`, `neutral`, `yellow`, `green`, `red`.
- Inline flex with border and rounded.

## Date/Time

- All date operations via `@js-temporal/polyfill` (never `Date.now()` etc.).
- Format utilities: `formatDateShort` (compact), `formatDateMed` (readable), `formatDateHuge` (full).
- Date range selector: query-parameter driven (`?from=...&until=...`), predefined tabs (14/30/90 days).
- Convert Temporal to JS Date for DB queries: `new Date(from.toZonedDateTime("UTC").epochMilliseconds)`.

## Responsive Design

- **sm (640px)**: Dialog sizing, footer layout, form footer reversal.
- **md (768px)**: Nav links visible, footer columns constrained, field orientation switch.
- Container queries: `@container/card-header`, `@container/field-group` with `@md/field-group:flex-row`.
- Tables scroll horizontally. Cards full width at all sizes.
- Button sizes scale down with `size` prop (`sm` in cards).
- Dialog: `max-w-[calc(100%-2rem)]` → `sm:max-w-lg`.

## Component Patterns

- Every component accepts `className` merged via `twMerge` (last wins for overrides).
- `cva` for variant-based styling. `useRender` for polymorphic `render` prop.
- `data-slot` attributes for child element targeting (e.g., `data-slot="card"`).
- Component variants: `default`, `ghost`, `destructive`, `outline`, `secondary`, `link`.

## Copy-to-Clipboard

- Use `navigator.clipboard.writeText()`.
- State: `copied` boolean, resets after 2s via `setTimeout`.
- Button toggles icon + text between copy and "Copied!" with checkmark.
