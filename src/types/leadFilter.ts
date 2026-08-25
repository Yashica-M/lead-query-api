/**
 * All the TypeScript types used across the lead query feature.
 */

/**
 * Who's making the request — pulled from validated headers by auth middleware.
 */
export type CurrentUser = {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'manager' | 'agent';
};

/** Data type of the field being filtered on. Controls which conditions are valid. */
export type FilterFieldType = 'string' | 'number' | 'date' | 'boolean';

/**
 * Every comparison operator the filter DSL supports.
 * Not all operators apply to all field types — that gets validated in filters.ts.
 */
export type FilterCondition =
  | 'is'
  | 'is not'
  | 'contain'
  | 'does not contain'
  | 'starts with'
  | 'ends with'
  | 'before'
  | 'after'
  | 'greater than'
  | 'less than'
  | 'is empty'
  | 'is not empty';

/**
 * A single filter from the request body.
 * value is optional because 'is empty' / 'is not empty' don't need one.
 * inputType flags multiselect agent fields (comma-separated UUIDs).
 */
export type LeadFilter = {
  fieldId: string;
  fieldType: FilterFieldType;
  condition: FilterCondition;
  value?: string;
  inputType?: string;
};

/** Shape of the POST body for /leads/query */
export type QueryLeadsBody = {
  q?: string;
  logic?: 'AND' | 'OR';
  filters?: LeadFilter[];
};

/**
 * Set used to tell apart built-in lead columns from custom EAV fields.
 * Using a Set so we get O(1) lookups instead of .includes() on an array.
 */
export const SYSTEM_FIELD_IDS = new Set([
  'name',
  'phone',
  'email',
  'assignedTo',
  'createdBy',
  'followUpDate',
  'createdAt',
  'updatedAt',
]);

/**
 * Maps the camelCase field names from the request to the actual snake_case
 * column names in Postgres. Needed because the API contract uses camelCase
 * but the DB schema uses snake_case.
 */
export const SYSTEM_FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  assignedTo: 'assigned_to',
  createdBy: 'user_id',
  followUpDate: 'follow_up_date',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/** Raw row shape from the leads table — snake_case matches Postgres column names */
export type LeadRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  phone: string;
  country_code: string;
  e164: string;
  email: string | null;
  assigned_to: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

/** Row shape returned from the batch custom field query */
export type CustomFieldValueRow = {
  lead_id: string;
  field_id: string;
  value: string;
  label: string;
};

/** Custom field after being attached to a lead response */
export type CustomFieldHydrated = {
  fieldId: string;
  label: string;
  value: string;
};

/** What the API sends back for each lead */
export type LeadResponse = {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  phone: string;
  countryCode: string;
  e164: string;
  email: string | null;
  assignedTo: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  customFields: CustomFieldHydrated[];
};

/** Pagination metadata included in every list response */
export type PaginationMeta = {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
};
