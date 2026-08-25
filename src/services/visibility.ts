/**
 * Determines row-level visibility based on the user's role.
 * Admins, owners and managers see all leads in their tenant.
 * Agents only see leads assigned to them.
 */

import { CurrentUser } from '../types/leadFilter';

export type SqlClause = {
  sql: string;
  bindings: unknown[];
};

// Returns a SQL clause to restrict visibility, or null if no restriction needed
export function buildVisibilityClause(user: CurrentUser): SqlClause | null {
  if (user.role === 'agent') {
    return {
      sql: 'leads.assigned_to = ?',
      bindings: [user.userId],
    };
  }

  return null;
}
