// ES2026 type declarations for Node 24 features used in this project.
// These are not yet in TypeScript's default ES2022 lib target.

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError
interface ErrorConstructor {
  isError(error: unknown): error is Error;
}
