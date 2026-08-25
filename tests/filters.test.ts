/**
 * Unit tests for the Filter DSL compiler.
 *
 * These are all pure function tests — no DB connection or HTTP layer needed.
 * Covers the core logic paths that would break silently if the SQL generation regressed.
 */

import { buildFilterClauses, buildSearchClause } from '../src/services/filters';

describe('buildFilterClauses', () => {
  it('returns null for an empty filter list', () => {
    const result = buildFilterClauses([], 'AND');
    expect(result).toBeNull();
  });

  it('generates correct ILIKE binding for "contain" on a system string field', () => {
    const result = buildFilterClauses(
      [{ fieldId: 'name', fieldType: 'string', condition: 'contain', value: 'Ram' }],
      'AND'
    );

    expect(result).not.toBeNull();
    expect(result!.sql).toContain('ILIKE');
    expect(result!.bindings).toContain('%Ram%');
  });

  it('joins multiple filters with OR correctly', () => {
    const result = buildFilterClauses(
      [
        { fieldId: 'name', fieldType: 'string', condition: 'contain', value: 'Ram' },
        { fieldId: 'name', fieldType: 'string', condition: 'contain', value: 'Sita' },
      ],
      'OR'
    );

    expect(result!.sql).toContain('OR');
    expect(result!.bindings).toEqual(['%Ram%', '%Sita%']);
  });

  it('generates EXISTS subquery for custom field UUIDs', () => {
    const result = buildFilterClauses(
      [
        {
          fieldId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          fieldType: 'string',
          condition: 'contain',
          value: 'Chennai',
        },
      ],
      'AND'
    );

    expect(result!.sql).toContain('EXISTS');
    expect(result!.sql).toContain('lead_custom_field_values');
    expect(result!.bindings).toContain('%Chennai%');
  });

  it('handles multiselect agent filter with = ANY(?)', () => {
    const uuids = '11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222';
    const result = buildFilterClauses(
      [
        {
          fieldId: 'assignedTo',
          fieldType: 'string',
          condition: 'is',
          value: uuids,
          inputType: 'multiselect',
        },
      ],
      'AND'
    );

    expect(result!.sql).toContain('ANY(?)');
    // Bindings should contain the array of UUIDs, not the raw string
    const binding = result!.bindings[0] as string[];
    expect(Array.isArray(binding)).toBe(true);
    expect(binding).toHaveLength(2);
  });

  it('throws BadRequestError for invalid condition on a string field', () => {
    expect(() =>
      buildFilterClauses(
        [{ fieldId: 'name', fieldType: 'string', condition: 'greater than', value: 'test' }],
        'AND'
      )
    ).toThrow('Condition "greater than" is not valid for field "name"');
  });

  it('generates correct IS NULL clause for "is empty" on a date field', () => {
    const result = buildFilterClauses(
      [{ fieldId: 'followUpDate', fieldType: 'date', condition: 'is empty' }],
      'AND'
    );

    expect(result!.sql).toContain('IS NULL');
    expect(result!.bindings).toHaveLength(0);
  });

  it('generates correct date cast for date "is" condition', () => {
    const result = buildFilterClauses(
      [{ fieldId: 'followUpDate', fieldType: 'date', condition: 'is', value: '2026-08-10' }],
      'AND'
    );

    expect(result!.sql).toContain('::date');
    expect(result!.bindings).toContain('2026-08-10');
  });

  it('throws BadRequestError for malformed date values', () => {
    expect(() =>
      buildFilterClauses(
        [{ fieldId: 'followUpDate', fieldType: 'date', condition: 'is', value: '10-08-2026' }],
        'AND'
      )
    ).toThrow('Expected YYYY-MM-DD');
  });
});

describe('buildSearchClause', () => {
  it('generates ILIKE predicates across name, phone, email, and e164', () => {
    const result = buildSearchClause('9000000001');

    expect(result.sql).toContain('leads.name ILIKE');
    expect(result.sql).toContain('leads.phone ILIKE');
    expect(result.sql).toContain('leads.email ILIKE');
    expect(result.sql).toContain('leads.e164 ILIKE');

    // All 4 columns get the same wildcard binding
    expect(result.bindings).toHaveLength(4);
    expect(result.bindings.every((b) => b === '%9000000001%')).toBe(true);
  });
});
