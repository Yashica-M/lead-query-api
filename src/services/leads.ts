/**
 * Main query service for leads.
 *
 * Runs three queries per request:
 *  1. COUNT — to build the pagination metadata
 *  2. Paginated SELECT — the actual page of results
 *  3. Batch custom field fetch — gets all custom field values for those leads in one query
 *
 * The batch approach on step 3 avoids N+1 queries. Without it, we'd run a separate
 * DB query per lead to fetch custom fields, which falls apart at any real scale.
 *
 * For followUpDate ASC sorts, we append NULLS LAST so leads without a date
 * don't float to the top (Postgres default is NULLS FIRST for ASC).
 */

import db from '../db/client';
import type { Knex } from 'knex';
import { CurrentUser, LeadFilter, LeadRow, CustomFieldValueRow, LeadResponse } from '../types/leadFilter';
import { QueryParams } from '../schemas/queryLeads';
import { buildVisibilityClause } from './visibility';
import { buildFilterClauses, buildSearchClause } from './filters';

type RawBinding = Knex.RawBinding;

const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'leads.created_at',
  followUpDate: 'leads.follow_up_date',
};

function formatDate(val: unknown): string | null {
  if (!val) return null;
  const d = new Date(val as string | number | Date);
  if (isNaN(d.getTime())) return String(val).split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Runs the lead search and returns a paginated, hydrated response.
 */
export async function queryLeads(
  user: CurrentUser,
  params: QueryParams,
  body: { q?: string; logic: 'AND' | 'OR'; filters: LeadFilter[] }
): Promise<{
  data: LeadResponse[];
  meta: { page: number; limit: number; totalRecords: number; totalPages: number };
}> {
  const { page, limit, sortBy, sortDirection } = params;
  const { q, logic, filters } = body;

  const whereClauses: string[] = [];
  const whereBindings: unknown[] = [];

  // Tenant isolation — every query is scoped to the requesting tenant
  whereClauses.push('leads.tenant_id = ?');
  whereBindings.push(user.tenantId);

  // Role-based visibility: agents can only see leads assigned to them
  const visibilityClause = buildVisibilityClause(user);
  if (visibilityClause) {
    whereClauses.push(visibilityClause.sql);
    whereBindings.push(...visibilityClause.bindings);
  }

  const searchAndFilterParts: string[] = [];
  const searchAndFilterBindings: unknown[] = [];

  if (q && q.trim()) {
    const searchClause = buildSearchClause(q.trim());
    searchAndFilterParts.push(searchClause.sql);
    searchAndFilterBindings.push(...searchClause.bindings);
  }

  // Append filter clauses from the request body
  const filterClause = buildFilterClauses(filters, logic);
  if (filterClause) {
    searchAndFilterParts.push(filterClause.sql);
    searchAndFilterBindings.push(...filterClause.bindings);
  }

  if (searchAndFilterParts.length > 0) {
    whereClauses.push(`(${searchAndFilterParts.join(' AND ')})`);
    whereBindings.push(...searchAndFilterBindings);
  }

  // Build the full WHERE clause
  const whereSQL = whereClauses.join(' AND ');

  // COUNT query — runs with the same WHERE clause so the total is always accurate
  const countResult = await db.raw<{ rows: [{ count: string }] }>(
    `SELECT COUNT(*) as count FROM leads WHERE ${whereSQL}`,
    whereBindings as RawBinding[]
  );
  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit);

  // Fetch the actual page of leads
  const offset = (page - 1) * limit;
  const sortColumn = SORT_COLUMN_MAP[sortBy];
  const orderDir = sortDirection.toUpperCase();

  const nullsHandling =
    sortBy === 'followUpDate' && sortDirection === 'asc' ? ' NULLS LAST' : '';

  const leadsResult = await db.raw<{ rows: LeadRow[] }>(
    `SELECT
      leads.id,
      leads.tenant_id,
      leads.user_id,
      leads.name,
      leads.phone,
      leads.country_code,
      leads.e164,
      leads.email,
      leads.assigned_to,
      leads.follow_up_date,
      leads.created_at,
      leads.updated_at
    FROM leads
    WHERE ${whereSQL}
    ORDER BY ${sortColumn} ${orderDir}${nullsHandling}
    LIMIT ? OFFSET ?`,
    [...whereBindings, limit, offset] as RawBinding[]
  );

  const leads = leadsResult.rows;

  if (leads.length === 0) {
    return {
      data: [],
      meta: { page, limit, totalRecords, totalPages },
    };
  }

  // Fetch custom field values for all leads on this page in a single query.
  // Grouping happens in JS after — avoids N+1 queries.
  const leadIds = leads.map((l) => l.id);

  const cfvResult = await db.raw<{ rows: CustomFieldValueRow[] }>(
    `SELECT
      lcfv.lead_id,
      lcfv.field_id,
      lcfv.value,
      cf.label
    FROM lead_custom_field_values lcfv
    JOIN custom_fields cf ON cf.id = lcfv.field_id
    WHERE lcfv.lead_id = ANY(?)`,
    [leadIds] as RawBinding[]
  );

  // Convert snake_case DB columns to camelCase for the API response
  const data: LeadResponse[] = leads.map((lead) => {
    const customFieldRows = cfvByLeadId.get(lead.id) ?? [];

    return {
      id: lead.id,
      tenantId: lead.tenant_id,
      userId: lead.user_id,
      name: lead.name,
      phone: lead.phone,
      countryCode: lead.country_code,
      e164: lead.e164,
      email: lead.email,
      assignedTo: lead.assigned_to,
      followUpDate: formatDate(lead.follow_up_date),
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      customFields: customFieldRows.map((cf) => ({
        fieldId: cf.field_id,
        label: cf.label,
        value: cf.value,
      })),
    };
  });

  return {
    data,
    meta: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
  };
}
