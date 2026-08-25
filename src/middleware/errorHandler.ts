/**
 * Global error handler.
 *
 * Catches any error thrown in route handlers or middleware.
 * AppError subclasses map to specific HTTP status codes; everything else becomes a 500.
 * Stack traces are never sent to the client.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Operational errors: Return formatted HTTP error response
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      statusCode: err.statusCode,
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  // Unhandled internal errors: Log diagnostic error stack server-side and suppress internal implementation leaks
  console.error('[Unhandled Operational Exception]', { requestId: req.headers['x-request-id'], err });
  res.status(500).json({
    message: 'Internal server error',
    statusCode: 500,
    error: err.message || String(err),
    requestId: req.headers['x-request-id'],
  });
}
