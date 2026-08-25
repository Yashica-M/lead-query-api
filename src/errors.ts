/**
 * Custom error classes for HTTP errors.
 *
 * Throwing one of these anywhere in the app causes the error middleware
 * to respond with the right status code and message, without leaking stack traces.
 */

/**
 * Base class for all app errors.
 * The Object.setPrototypeOf call is needed because TypeScript compiling to ES5
 * breaks instanceof checks for subclasses of built-in types like Error.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;

    // Explicitly restore prototype chain broken by ES5 compilation targets in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 Bad Request — Thrown when request DTO validation or DSL compilation fails.
 */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized — Thrown when required identity headers are missing or malformed.
 */
export class UnauthenticatedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

/**
 * 403 Forbidden — Thrown when verified principal lacks sufficient role permissions.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

/**
 * 404 Not Found — Thrown when requested resource entity does not exist.
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}
