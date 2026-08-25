/**
 * Auth middleware — reads identity from request headers.
 *
 * In a real setup this would verify a JWT from an API gateway.
 * For this take-home, identity is passed as plain headers so we can
 * test different roles without needing a full auth service running.
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthenticatedError } from '../errors';
import { CurrentUser } from '../types/leadFilter';

const VALID_ROLES: CurrentUser['role'][] = ['owner', 'admin', 'manager', 'agent'];

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'];
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];

  if (!tenantId || typeof tenantId !== 'string') {
    throw new UnauthenticatedError('Missing required header: x-tenant-id');
  }
  if (!userId || typeof userId !== 'string') {
    throw new UnauthenticatedError('Missing required header: x-user-id');
  }
  if (!role || typeof role !== 'string') {
    throw new UnauthenticatedError('Missing required header: x-user-role');
  }

  if (!VALID_ROLES.includes(role as CurrentUser['role'])) {
    throw new UnauthenticatedError(
      `Invalid x-user-role: "${role}". Must be one of: ${VALID_ROLES.join(', ')}`
    );
  }

  req.currentUser = {
    tenantId,
    userId,
    role: role as CurrentUser['role'],
  };

  next();
}
