/**
 * Migration: Create the `lead_custom_field_values` table (EAV pattern)
 *
 * EAV = Entity-Attribute-Value. This is how we store custom field values.
 *
 * Instead of:
 *   leads.city = "Chennai"       ← requires a new column each time
 *
 * We store:
 *   lead_id | field_id (city)  | value
 *   L1      | city-uuid        | Chennai
 *   L1      | budget-uuid      | 50000
 *
 * This lets tenants define unlimited custom fields without schema changes.
 *
 * TRADEOFF: EAV makes filtering slightly more complex — we use EXISTS
 * subqueries to check if a lead has a custom field value matching the filter.
 * All values are stored as TEXT and cast at query time.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lead_custom_field_values', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Which lead does this value belong to?
    table
      .uuid('lead_id')
      .notNullable()
      .references('id')
      .inTable('leads')
      .onDelete('CASCADE'); // If a lead is deleted, delete its custom values too

    // Which custom field definition?
    table
      .uuid('field_id')
      .notNullable()
      .references('id')
      .inTable('custom_fields')
      .onDelete('CASCADE');

    // The actual value, stored as text regardless of field type
    // e.g., "Chennai", "50000", "2026-08-01", "true"
    table.text('value').notNullable();

    // A lead can only have ONE value per field
    // (you can't have City = "Chennai" AND City = "Madurai" for the same lead)
    table.unique(['lead_id', 'field_id']);

    // Index for fast lookups when filtering
    table.index(['field_id', 'lead_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lead_custom_field_values');
}
