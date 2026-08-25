/**
 * Zod validation schemas for the /leads/query endpoint.
 *
 * Validates both URL query parameters and the POST body before anything
 * hits the service layer. Better to fail here with a clear 400 than let
 * bad input corrupt a query.
 */

import { z } from 'zod';

/**
 * URL query params: ?page=1&limit=20&sortBy=createdAt&sortDirection=desc
 * z.coerce handles the fact that query params always come in as strings.
 */
export const queryParamsSchema = z.object({
  page: z.coerce
    .number()
    .int('page must be an integer')
    .min(1, 'page must be ≥ 1')
    .default(1),

  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be ≥ 1')
    .max(100, 'limit must be ≤ 100')
    .default(20),

  sortBy: z
    .enum(['createdAt', 'followUpDate'], {
      errorMap: () => ({ message: 'sortBy must be "createdAt" or "followUpDate"' }),
    })
    .default('createdAt'),

  sortDirection: z
    .enum(['asc', 'desc'], {
      errorMap: () => ({ message: 'sortDirection must be "asc" or "desc"' }),
    })
    .default('desc'),
});

const filterConditionSchema = z.enum([
  'is',
  'is not',
  'contain',
  'does not contain',
  'starts with',
  'ends with',
  'before',
  'after',
  'greater than',
  'less than',
  'is empty',
  'is not empty',
]);

const filterFieldTypeSchema = z.enum(['string', 'number', 'date', 'boolean']);

/**
 * Single predicate validation schema within Filter DSL payload.
 */
const leadFilterSchema = z.object({
  fieldId: z.string().min(1, 'fieldId is required'),
  fieldType: filterFieldTypeSchema,
  condition: filterConditionSchema,
  value: z.string().optional(),
  inputType: z.string().optional(),
});

/**
 * Request body schema for `POST /api/v1/leads/query`.
 * Normalises empty string search terms (`q`) to undefined via transform step.
 */
export const queryLeadsBodySchema = z.object({
  q: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),

  logic: z.enum(['AND', 'OR']).default('AND'),

  filters: z.array(leadFilterSchema).optional().default([]),
});

/**
 * Inferred TypeScript types from the schemas above.
 * This way the types and validation always stay in sync.
 */
export type QueryParams = z.infer<typeof queryParamsSchema>;
export type QueryLeadsBody = z.infer<typeof queryLeadsBodySchema>;
export type LeadFilterValidated = z.infer<typeof leadFilterSchema>;
