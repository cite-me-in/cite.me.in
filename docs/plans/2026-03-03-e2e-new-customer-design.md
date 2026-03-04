# End-to-End New Customer Test Design

**Date:** 2026-03-03
**Feature:** Complete customer onboarding flow test from signup to citations view

## Overview

End-to-end test that verifies the complete new customer journey: visiting the home page, signing up for an account, adding a website, accepting query suggestions, and viewing LLM citations. The test includes step-by-step assertions of both UI state (redirects, page content) and database changes (user, site, queries created). Optional slow mode allows watching the test execute step-by-step for debugging.

## Requirements

- Test the full happy path: home → sign-up → add site → query suggestions → citations
- Verify redirects occur after each major step
- Verify data is created in database at key checkpoints
- Mock LLM response with 9 custom query suggestions
- Use dynamic email and domain (timestamp-based) to avoid conflicts
- Keep test data in database for manual inspection (no cleanup)
- Support slow mode: `SLOW_MO=3000` environment variable for step-by-step watching
- Execute in ~few seconds normally, ~27 seconds with slow mode (3s per step)

## Architecture

### File Structure

**Test file:** `test/e2e/new-customer.test.ts`

This creates a new `test/e2e/` directory separate from route tests to clearly distinguish full integration tests from route-specific tests.

### MSW Mocking Strategy

**Extension to existing MSW setup:**
- Extend `test/mocks/msw.ts` to add a handler for the Anthropic API endpoint
- Intercept requests to the LLM and return a mock response with 9 custom queries
- Mock queries: `["Query 1", "Query 2", ..., "Query 9"]` across 3 groups: `["1.discovery", "2.active_search", "3.comparison"]`
- The real `generateSiteQueries` function executes normally, just receives mocked LLM response
- All other external requests remain blocked (existing MSW behavior)

### Test Data Strategy

**Dynamic, timestamp-based data:**
- Email: `${Date.now()}@example.com` (e.g., `1740945000000@example.com`)
- Domain: `${Date.now()}.example.com` (e.g., `1740945000000.example.com`)
- Password: `TestPassword123!` (fixed, safe for tests)

**Isolation:**
- Each test run gets unique email/domain based on current timestamp
- No test data cleanup needed (previous runs use different timestamps)
- Test data persists in database for manual inspection

### Slow Mode Implementation

**Environment variable-based delays:**
- Parse `process.env.SLOW_MO` as milliseconds (default: 0 = no delay)
- Create helper: `const pause = () => SLOW_MO > 0 ? new Promise(r => setTimeout(r, SLOW_MO)) : null`
- Call `await pause()` after each user interaction (click, fill, submit)
- Allows running with `SLOW_MO=3000 pnpm test` for step-by-step execution

**Timing:**
- Normal run: ~few seconds (all interactions fast)
- Slow mode: ~27 seconds (3 seconds × ~9 interactions)

## Test Flow

### Step-by-Step Flow with Assertions

1. **Home Page**
   - Verify at URL: `/`
   - Assert: heading about tracking citations visible
   - Assert: "Get Started" button visible
   - Action: Click "Get Started" button

2. **Sign-Up Form**
   - Verify redirect to `/sign-up`
   - Assert: Email, password, and confirm password inputs visible
   - Action: Fill email with `${Date.now()}@example.com`
   - Action: Fill password with `TestPassword123!`
   - Action: Fill confirm password with `TestPassword123!`
   - Action: Submit form

3. **After Sign-Up (Redirect & Data)**
   - Verify redirect to `/sites/new`
   - Assert: User created in database with correct email
   - Assert: Account created and associated with user

4. **Site Add Form**
   - Verify at URL: `/sites/new`
   - Assert: "Website URL or domain" input visible
   - Assert: "Add Site" button visible
   - Action: Fill domain with `${Date.now()}.example.com`
   - Action: Submit form

5. **After Site Add (Redirect & Data)**
   - Verify redirect to `/site/{id}/queries` (extract site ID from URL)
   - Assert: Site created in database with correct domain
   - Assert: Site associated with user's account

6. **Query Suggestions Page**
   - Verify at URL: `/site/{id}/queries`
   - Assert: 9 query suggestion rows visible
   - Assert: "Accept All" button visible

7. **Accept All Queries**
   - Action: Click "Accept All" button
   - Action: Wait for form submission

8. **After Accept Queries (Redirect & Data)**
   - Verify redirect to `/site/{id}/citations`
   - Assert: 9 SiteQuery records created in database for the site
   - Assert: Each query text matches the mock queries provided to LLM

9. **Citations Page**
   - Verify at URL: `/site/{id}/citations`
   - Assert: Page heading "Citations" visible
   - Assert: Site domain visible on page

### Assertion Types

**URL/Redirect verification:**
- After each form submission, verify the page URL matches expected route

**UI verification:**
- Verify forms, buttons, and content are visible before interaction
- Use Playwright `getByRole`, `getByText`, `getByLabel` for semantic selectors

**Database verification:**
- Query Prisma after key actions to verify data was created
- Verify relationships: user → account, site → account, queries → site

## Error Handling

The test tests the happy path only. If any step fails:
- Playwright assertion fails with clear message (e.g., "Button not found")
- Test stops at that step
- Database state shows what was partially created (useful for debugging)

No explicit error handling needed; test failures clearly indicate where the flow broke.

## Testing Strategy

**What this test verifies:**
- User can sign up with valid credentials
- User is redirected to site add page after sign-up
- User can add a website
- User is redirected to query suggestions page
- Query suggestions are generated and displayed
- User can accept all suggestions
- Queries are saved to database
- User is redirected to citations page

**What this test does NOT verify:**
- Error cases (invalid password, duplicate email, invalid domain)
- Edge cases (very long domain, special characters in email)
- Specific LLM behavior (those are tested elsewhere)
- Search/filtering of queries (handled in route tests)

**Test isolation:**
- Each run is independent (unique timestamp data)
- No fixtures or shared state between runs
- Can run multiple times in sequence without conflicts

## Implementation Notes

- Test file size: ~150-200 lines (straightforward linear flow)
- No test-specific factories or helpers needed (inline data generation)
- MSW handler addition: ~10 lines to `test/mocks/msw.ts`
- No changes to application code
- Test can be added and run immediately after implementation

## Files to Modify

1. Create: `test/e2e/new-customer.test.ts`
2. Modify: `test/mocks/msw.ts` (add LLM API handler)
