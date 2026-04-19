# AI Legibility Checker

A free tool that validates whether a website is readable by AI agents and suggests improvements.

## User Flow

1. User visits `/ai-legibility` (public, rate-limited)
2. Enters a URL/domain
3. Sees live activity log as checks run
4. Gets categorized pass/fail results
5. Sees contextual, actionable suggestions
6. Can export JSON report

### Logged-in users additionally:
- Report saved to their account
- Email with results sent automatically
- MCP integration for LLM-assisted fixes

## What Gets Tested

### Critical (blocks AI discovery entirely)

| Test | What it checks |
|------|----------------|
| Homepage content | Homepage returns actual content (not empty SPA shell) |
| sitemap.txt exists | Plain-text sitemap is accessible at `/sitemap.txt` |
| sitemap.txt valid | File contains valid URLs, one per line |
| sitemap.xml readable | XML sitemap served with `text/xml` or `application/xml` is parseable |

### Important (improves AI understanding)

| Test | What it checks |
|------|----------------|
| Sample pages have content | 5-10 URLs from sitemap return actual content (10s per-page timeout, 2m total timeout) |
| Sample pages timeout | Any pages that timeout are flagged as issues |
| JSON-LD structured data | Pages include valid JSON-LD with schema validation (Article, Organization, etc.) |
| robots.txt exists | Robots file present and parseable |
| Meta description | Homepage has meta description tag |

### Optimization (nice to have)

| Test | What it checks |
|------|----------------|
| llms.txt exists | AI-specific content index at `/llms.txt` |
| Open Graph tags | Pages have OG tags for social sharing |
| Canonical URLs | Pages have self-referencing canonical link |

## Output Format

### Activity Log (live during scan)

```
✓ Fetching homepage...
✓ Homepage returns 1,247 characters of content
✓ Found meta description: "Your SaaS for..."
✓ Checking /sitemap.txt...
✓ sitemap.txt found with 12 URLs
✓ Checking /sitemap.xml...
✗ sitemap.xml served as application/xml (may be treated as binary)
✓ Checking /robots.txt...
✓ robots.txt found
...
```

### Results Report

Grouped by category with pass/fail badges:

**Critical: 4/4 passed**
- ✓ Homepage returns content
- ✓ sitemap.txt exists and valid
- ✓ sitemap.xml readable
- ...

**Important: 2/4 passed**
- ✓ Sample pages have content (3/5 passed)
- ✗ JSON-LD not found
- ...

**Optimization: 1/3 passed**
- ...

### Suggestions

Contextual suggestions generated based on specific failures found:

**Example for failed sitemap.txt:**
> Your site doesn't have a sitemap.txt file at the root. For johnbrennan.xyz, this would be https://johnbrennan.xyz/sitemap.txt. Create a plain-text file listing all your important URLs, one per line. This is the single most impactful change for AI discoverability — AI agents can immediately discover all your content from one file.

**Example for empty homepage:**
> Your homepage at https://example.com returns only an empty shell (likely a React SPA without server-side rendering). AI agents don't execute JavaScript, so they see nothing. Add server-side rendering or inject a hidden `<nav>` block with your main content links into the HTML response.

**Example for JSON-LD validation failure:**
> Your page has JSON-LD but it failed schema validation: "Missing required field 'name' for Article schema". Fix the JSON-LD block in your page template to include all required fields for the schema type you're using.

Suggestions are generated contextually using LLM based on the specific failure details, URL, and page content.

## Implementation Plan

### Routes

- `app/routes/ai-legibility/route.tsx` - Main page with form
- `app/routes/ai-legibility.scan.ts` - Action that starts scan (rate-limited, no auth required)
- `app/routes/ai-legibility.status.ts` - Loader for progress polling
- `app/routes/ai-legibility.$scanId.tsx` - Saved report view (auth required for user's own reports)

### Library

- `app/lib/aiLegibility/runScan.ts` - Main scan orchestrator
- `app/lib/aiLegibility/generateSuggestions.ts` - LLM-powered contextual suggestions
- `app/lib/aiLegibility/progress.server.ts` - Redis progress tracking (anonymous + user)
- `app/lib/aiLegibility/checks/` - Individual check functions
  - `homepageContent.ts`
  - `sitemapTxt.ts`
  - `sitemapXml.ts`
  - `robotsTxt.ts`
  - `samplePages.ts` - checks 5-10 pages with 2-minute total timeout
  - `jsonLd.ts` - validates against schema.org types
  - `metaTags.ts`

### Database

Add model for saved reports:

```prisma
model AiLegibilityReport {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  url         String
  scannedAt   DateTime @default(now())
  result      Json     // Full ScanResult
  createdAt   DateTime @default(now())
  
  @@index([userId])
}
```

### Email

- `app/emails/AiLegibilityReport.tsx` - Email template with summary and link to full report

### MCP

Add tool for logged-in users:

```ts
{
  name: "fix_ai_legibility",
  description: "Help fix issues found in your AI legibility report",
  parameters: {
    reportId: "ID of the report to work on",
    issueName: "Specific issue to fix (optional)"
  }
}
```

Returns the report details and can fetch page content to help the LLM suggest code changes.

### Progress Storage

Redis keys for anonymous scans:
```
ai-legibility:{scanId}:log
ai-legibility:{scanId}:status
ai-legibility:{scanId}:result
```

Saved reports for logged-in users stored in database after completion.

### Types

```ts
type CheckResult = {
  name: string;
  category: "critical" | "important" | "optimization";
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  timeout?: boolean; // For sample pages that timed out
};

type ScanResult = {
  url: string;
  scannedAt: string;
  checks: CheckResult[];
  summary: {
    critical: { passed: number; total: number };
    important: { passed: number; total: number };
    optimization: { passed: number; total: number };
  };
  suggestions: Suggestion[];
};

type Suggestion = {
  title: string;
  category: "critical" | "important" | "optimization";
  effort: "2 min" | "5 min" | "15 min" | "1 hour";
  description: string;
  fixExample?: string; // Code snippet or URL example
};
```

## Cost Considerations

- LLM call for contextual suggestions (one call per scan, ~500 tokens)
- HTTP fetches for all checks (no LLM needed for checks themselves)
- Redis for temporary storage (same TTL as setup: 24h)
- Database writes for logged-in users' saved reports
- Email for logged-in users

### Rate Limiting

- 5 scans per hour per IP address
- Uses existing `rateLimit.server.ts`

## Next Steps

1. Add `AiLegibilityReport` model to schema
2. Create the scan library with all checks
3. Create suggestion generator (LLM-powered)
4. Create the routes (page, scan action, status loader, saved report view)
5. Build the UI with activity log and results display
6. Add JSON export
7. Add email template and sending logic
8. Add MCP tool for logged-in users
9. Test with real websites
