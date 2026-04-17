# Coding Conventions

## Imports

- Use `import type` for type-only imports
- Use `~/` for all internal imports; relative paths only for same-directory files
- Order: external packages → internal (`~/`) → relative (`./`)

```ts
import { captureException } from "@sentry/react-router";
import { requireUser } from "~/lib/auth.server";
import RecentVisibility from "./RecentVisibility";
```

## Exports

- Default exports for functions and components; named exports for types
- No barrel files (`index.ts` re-exports)

```ts
export default function queryClaude(query: string) { ... }
export type QueryFn = (query: string) => Promise<...>;
```

## Braces

Omit braces when the body is a single statement — applies to `if`, `else`, `for`, `while`, and `else if`:

```ts
if (existing) return;
if (!site) throw new Response("Not found", { status: 404 });
for (const site of sites) await process(site);
```

Use braces for multi-line bodies.

## Functions

- Named parameter objects for any function with more than one argument
- Early returns over nested conditionals

```ts
async function queryPlatform({ site, platform, queries }: { ... }) {
  if (existing) return;
  if (!site) throw new Response("Not found", { status: 404 });
}
```

## TypeScript

- Prefer inference; annotate function parameters and non-obvious return types
- Inline object types for simple shapes; named types for reused or complex ones
- `as const` for config arrays and literal tuples
- `invariant()` from `es-toolkit` for runtime assertions

## Error handling

- `try/catch` + `captureAndLogError` at orchestration layer only; let errors bubble from helpers
- Return `{ error: string }` from actions for user-facing errors; throw for unexpected ones
- Use `captureAndLogError` from `~/lib/captureAndLogError.server` — it calls Sentry, debug logger, console, and Logtail in one call
- When auth helpers (`requireUser`, `requireSiteAccess`) are called inside a try/catch, re-throw `Response` so 404/403/redirects aren't swallowed:

```ts
import captureAndLogError from "~/lib/captureAndLogError.server";

try {
  await prisma.user.update(...);
  return { success: "Email updated" };
} catch (error) {
  captureAndLogError(error);
  return { error: "That email is already in use" };
}

// Auth inside try/catch — must re-throw Response:
try {
  const site = await requireSiteAccess(params.domain, user.id);
  // ...
} catch (error) {
  if (error instanceof Response) throw error;
  captureAndLogError(error);
  return { error: "Something went wrong" };
}
```

## Logging

Printf-style with a `[context:subcontext]` prefix — no template literals:

```ts
const logger = debug("server");

logger("[%s:%s] Created run %s", site.id, platform, run.id);
logger("[%s:%s] Failed: %o", site.id, platform, error);
```

## React Router

- Loaders return plain data objects; actions return `{ error }` / `{ success }` or redirect
- Destructure `loaderData` / `actionData` in component props
- Use `useFetcher` for sub-forms that shouldn't navigate on submit
- Type fetchers as `useFetcher<typeof action>()` to get typed `.data`
- Actions return `{ ok: true as const }` / `{ ok: false as const, error: string }` — never throw for user-facing errors
- Flat route `foo.$id_.bar` (underscore after param) avoids nesting inside the `foo.$id` layout

## Naming

- Files: `kebab-case.ts`; React components: `PascalCase.tsx`
- Variables and functions: `camelCase`; types and interfaces: `PascalCase`
- Module-level constants: `SCREAMING_SNAKE_CASE`

## Libraries

- `radashi` for array/object utilities (not lodash); `tiny-invariant` for runtime assertions
- `@js-temporal/polyfill` for date/time (not `Date`)
- `twMerge` + `cva` for conditional class names on UI components

## UI components

- Prefer components from `app/components/ui/` when available (Button, Input, Card, Table, Tabs, etc.)
- If a new UI component is needed, ask the user before creating it
- Override component styles via `className` — `twMerge` handles conflicts, so e.g. `bg-transparent shadow-none` correctly wins over defaults
- `PageLoadingBouncer`: add to any page with date-range tabs or other navigation triggers — shows bouncing-dot overlay while `useNavigation()` is not idle

## Emails

- All links and buttons in email templates must go through the `/r` proxy route (e.g. `https://cite.me.in/r?url=...`) — this handles link click tracking and user verification
- Use the `SentEmail` model to deduplicate automated emails (e.g. trial reminders); check for an existing record before sending, insert after sending
- Send emails via helpers in `~/emails/`; never call Resend directly from route handlers

## Prisma / schema

- All child relations use `onDelete: Cascade`
- Add `updatedAt DateTime @map("updated_at") @updatedAt` to every mutable model
- After schema changes: `pnpm prisma db push` then `pnpm prisma generate`

## Testing

- Test name starts with "should", eg `it("should receive status code 200", async () => { ... })`
- Single test file: `vitest run test/routes/home.test.ts`
- `test/routes/` = Playwright browser tests; files with only `fetch` calls = HTTP tests; `test/llm-visibility/` = LLM integration (needs real API keys in `.env`)
- Prefer integration tests against a real DB over mocked unit tests
- Use fixed IDs in test seed data to avoid conflicts across test files (`id: "user-bots-1"`, etc.)
- Playwright strict mode: `getByRole` / `getByText` throw when multiple elements match — use `{ exact: true }` or scope the locator to a parent element
- When mocking SDK responses, include ALL fields the SDK's internal schema expects — even ones your code doesn't use. The AI SDK validates responses against Zod schemas, so missing fields cause validation errors. Trust Zod error paths (e.g., `expected array, received undefined` at `output[1].content[0].annotations`)

## Project structure

- `~/` → `app/`; `~/prisma` → `prisma/generated/client`
- Auth: `getCurrentUser(request)` (root loader, nullable) and `requireUser(request)` (protected routes, throws redirect) — see `app/lib/auth.server.ts`
- Site access: `requireSiteAccess(domain, userId)` (member or owner, throws 404) and `requireSiteOwner(domain, userId)` (owner only, throws 403) — see `app/lib/sites.server.ts`; use these in every site route instead of inlining `prisma.site.findFirst`
- Site routes use `$domain` URL param (e.g. `site.$domain_.citations`) — the domain uniquely identifies a site per user
- Blog post dates come from filenames: `app/data/blog/YYYY-MM-DD-slug.md`
- Do NOT add `react`/`react-dom` to `optimizeDeps.include` in `vite.config.ts` — creates duplicate React instances that break all hooks

## Model selection

Use model "haiku" for trivial lookup (single file search, simple questions)
Use model "sonnet" for more complex tasks (research, exploration, architecture, writing code)
DO NOT USE MODEL "OPUS"
