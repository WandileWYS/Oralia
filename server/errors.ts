export class ServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly retryable = false, public readonly indeterminate = false) {
    super(message);
    this.name = 'ServiceError';
  }
}
