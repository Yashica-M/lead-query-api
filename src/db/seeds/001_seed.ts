/**
 * Seed file: Insert all sample data for testing
 *
 * These are FIXED UUIDs so reviewers can use them directly in curl commands
 * without looking anything up. Document them in README.
 *
 * TENANT A: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 * TENANT B: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
 */

import type { Knex } from 'knex';

// ─── Fixed UUIDs ─────────────────────────────────────────────────────────────
// These are intentionally simple/memorable so reviewers can use them in curls

export const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// Tenant A users
export const ADMIN_A = '00000000-0000-0000-0000-000000000001'; // admin role
export const AGENT_A1 = '11111111-1111-1111-1111-111111111111'; // agent role
export const AGENT_A2 = '22222222-2222-2222-2222-222222222222'; // agent role

// Tenant B users
export const USER_B1 = 'bbbb0000-0000-0000-0000-000000000001';
export const AGENT_B1 = 'bbbb1111-1111-1111-1111-111111111111';

// Custom fields
export const CITY_FIELD_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // Tenant A: City
export const BUDGET_FIELD_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'; // Tenant B: Budget

// Lead IDs (Tenant A)
const LEAD_L1 = 'e0000001-0000-0000-0000-000000000001'; // Ram Kumar
const LEAD_L2 = 'e0000002-0000-0000-0000-000000000002'; // Ramesh
const LEAD_L3 = 'e0000003-0000-0000-0000-000000000003'; // Priya
const LEAD_L4 = 'e0000004-0000-0000-0000-000000000004'; // Anand
const LEAD_L5 = 'e0000005-0000-0000-0000-000000000005'; // Sita

// Lead IDs (Tenant B)
const LEAD_B1 = 'f0000001-0000-0000-0000-000000000001';
const LEAD_B2 = 'f0000002-0000-0000-0000-000000000002';

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data (in reverse order due to foreign key constraints)
  // truncate = delete all rows and reset sequences
  await knex('lead_custom_field_values').del();
  await knex('leads').del();
  await knex('custom_fields').del();

  // ─── 1. Custom Fields ───────────────────────────────────────────────────────
  await knex('custom_fields').insert([
    {
      id: CITY_FIELD_ID,
      tenant_id: TENANT_A,
      label: 'City',
      type: 'string',
      status: true,
    },
    {
      id: BUDGET_FIELD_ID,
      tenant_id: TENANT_B,
      label: 'Budget',
      type: 'number',
      status: true,
    },
  ]);

  // ─── 2. Tenant A Leads ──────────────────────────────────────────────────────
  //
  // The spec's sample dataset:
  // | Lead | Name      | Phone      | Assigned to | Follow-up  | City       |
  // | L1   | Ram Kumar | 9000000001 | Agent A1    | 2026-08-10 | Chennai    |
  // | L2   | Ramesh    | 9000000002 | Agent A1    | 2026-07-01 | Madurai    |
  // | L3   | Priya     | 9000000003 | Agent A2    | null       | Chennai    |
  // | L4   | Anand     | 9000000004 | null        | 2026-08-15 | Coimbatore |
  // | L5   | Sita      | 9000000005 | Agent A2    | 2026-08-01 | Chennai    |

  await knex('leads').insert([
    {
      id: LEAD_L1,
      tenant_id: TENANT_A,
      user_id: ADMIN_A,
      name: 'Ram Kumar',
      phone: '9000000001',
      country_code: '+91',
      e164: '+919000000001',
      email: 'ram@example.com',
      assigned_to: AGENT_A1,
      follow_up_date: '2026-08-10',
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
    },
    {
      id: LEAD_L2,
      tenant_id: TENANT_A,
      user_id: ADMIN_A,
      name: 'Ramesh',
      phone: '9000000002',
      country_code: '+91',
      e164: '+919000000002',
      email: 'ramesh@example.com',
      assigned_to: AGENT_A1,
      follow_up_date: '2026-07-01',
      created_at: '2026-01-02T10:00:00Z',
      updated_at: '2026-01-02T10:00:00Z',
    },
    {
      id: LEAD_L3,
      tenant_id: TENANT_A,
      user_id: ADMIN_A,
      name: 'Priya',
      phone: '9000000003',
      country_code: '+91',
      e164: '+919000000003',
      email: 'priya@example.com',
      assigned_to: AGENT_A2,
      follow_up_date: null,
      created_at: '2026-01-03T10:00:00Z',
      updated_at: '2026-01-03T10:00:00Z',
    },
    {
      id: LEAD_L4,
      tenant_id: TENANT_A,
      user_id: ADMIN_A,
      name: 'Anand',
      phone: '9000000004',
      country_code: '+91',
      e164: '+919000000004',
      email: null,
      assigned_to: null,
      follow_up_date: '2026-08-15',
      created_at: '2026-01-04T10:00:00Z',
      updated_at: '2026-01-04T10:00:00Z',
    },
    {
      id: LEAD_L5,
      tenant_id: TENANT_A,
      user_id: ADMIN_A,
      name: 'Sita',
      phone: '9000000005',
      country_code: '+91',
      e164: '+919000000005',
      email: 'sita@example.com',
      assigned_to: AGENT_A2,
      follow_up_date: '2026-08-01',
      created_at: '2026-01-05T10:00:00Z',
      updated_at: '2026-01-05T10:00:00Z',
    },
  ]);

  // ─── 3. Tenant B Leads ──────────────────────────────────────────────────────
  // These must NEVER appear when querying as Tenant A (tenant isolation test)

  await knex('leads').insert([
    {
      id: LEAD_B1,
      tenant_id: TENANT_B,
      user_id: USER_B1,
      name: 'Ram B (Tenant B)',
      phone: '8000000001',
      country_code: '+91',
      e164: '+918000000001',
      email: 'ram_b@example.com',
      assigned_to: AGENT_B1,
      follow_up_date: null,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
    },
    {
      id: LEAD_B2,
      tenant_id: TENANT_B,
      user_id: USER_B1,
      name: 'Chennai Lead (Tenant B)',
      phone: '8000000002',
      country_code: '+91',
      e164: '+918000000002',
      email: null,
      assigned_to: null,
      follow_up_date: '2026-09-01',
      created_at: '2026-01-02T10:00:00Z',
      updated_at: '2026-01-02T10:00:00Z',
    },
  ]);

  // ─── 4. Custom Field Values (EAV) ───────────────────────────────────────────
  // Assign City values to Tenant A leads

  await knex('lead_custom_field_values').insert([
    { lead_id: LEAD_L1, field_id: CITY_FIELD_ID, value: 'Chennai' },
    { lead_id: LEAD_L2, field_id: CITY_FIELD_ID, value: 'Madurai' },
    { lead_id: LEAD_L3, field_id: CITY_FIELD_ID, value: 'Chennai' },
    { lead_id: LEAD_L4, field_id: CITY_FIELD_ID, value: 'Coimbatore' },
    { lead_id: LEAD_L5, field_id: CITY_FIELD_ID, value: 'Chennai' },
  ]);

  // Tenant B: Budget values
  await knex('lead_custom_field_values').insert([
    { lead_id: LEAD_B1, field_id: BUDGET_FIELD_ID, value: '75000' },
    { lead_id: LEAD_B2, field_id: BUDGET_FIELD_ID, value: '120000' },
  ]);

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📋 Quick Reference UUIDs:');
  console.log(`   Tenant A:      ${TENANT_A}`);
  console.log(`   Tenant B:      ${TENANT_B}`);
  console.log(`   Admin A:       ${ADMIN_A}`);
  console.log(`   Agent A1:      ${AGENT_A1}`);
  console.log(`   Agent A2:      ${AGENT_A2}`);
  console.log(`   City Field ID: ${CITY_FIELD_ID}`);
}
