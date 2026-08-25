/**
 * Migration: Create the `custom_fields` table
 *
 * Custom fields allow each tenant to define their own extra data fields
 * (e.g., Tenant A might want "City" and "Budget", Tenant B might want
 * "Source" and "Industry").
 *
 * Instead of adding a new column to `leads` for every custom field
 * (which would require a database change every time), we store field
 * definitions here and values in the EAV table.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('custom_fields', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Each custom field belongs to one tenant
    table.uuid('tenant_id').notNullable();

    // Human-readable name shown in the UI (e.g., "City", "Budget")
    table.string('label').notNullable();

    // Data type of this field — determines which filter operators are valid
    // Values: 'string' | 'number' | 'date' | 'boolean'
    table.string('type').notNullable();

    // Whether this field is active. Inactive fields can be ignored in filters.
    table.boolean('status').defaultTo(true);

    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    // A tenant can't have two custom fields with the same label
    table.unique(['tenant_id', 'label']);
    table.index('tenant_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('custom_fields');
}
