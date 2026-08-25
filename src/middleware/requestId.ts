import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a correlation ID to every request for distributed tracing.
 * Uses the incoming X-Request-ID header if provided (e.g. from an API gateway),
 * otherwise generates a fresh UUID. The ID is echoed back in the response
 * so clients can tie their requests to server-side logs.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
