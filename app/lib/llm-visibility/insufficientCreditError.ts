export class InsufficientCreditError extends Error {
  constructor(
    public platform: string,
    public statusCode: number,
  ) {
    super(`${platform}: insufficient credit (HTTP ${statusCode})`);
    this.name = "InsufficientCreditError";
  }
}

export function isInsufficientCreditError(
  error: unknown,
): error is InsufficientCreditError {
  return error instanceof InsufficientCreditError;
}
