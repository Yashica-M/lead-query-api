/**
 * Translates the filter DSL from the request body into parameterized SQL WHERE clauses.
 *
 * Two types of fields:
 *  - System fields (name, phone, assignedTo, etc.) → direct column comparisons
 *  - Custom fields (UUID fieldIds) → correlated EXISTS subqueries against lead_custom_field_values
 *
 * Using EXISTS instead of JOIN for custom fields because a JOIN would duplicate rows
 * when a lead has multiple custom field values, which breaks COUNT and distinct lead results.
 *
 * All values go through parameterized bindings (?) — never string-interpolated into SQL.
 */

import { BadRequestError } from '../errors';
import {
  LeadFilter,
  FilterCondition,
  SYSTEM_FIELD_IDS,
  SYSTEM_FIELD_TO_COLUMN,
} from '../types/leadFilter';

export type SqlClause = {
  sql: string;
  bindings: unknown[];
};

// Which conditions are valid for each field type
const VALID_STRING_CONDITIONS: FilterCondition[] = [
  'is',
  'is not',
  'contain',
  'does not contain',
  'starts with',
  'ends with',
  'is empty',
  'is not empty',
];

const VALID_DATE_CONDITIONS: FilterCondition[] = [
  'is',
  'before',
  'after',
  'is empty',
  'is not empty',
];

const VALID_NUMBER_CONDITIONS: FilterCondition[] = [
  'is',
  'is not',
  'greater than',
  'less than',
  'is empty',
  'is not empty',
];

const VALID_BOOLEAN_CONDITIONS: FilterCondition[] = ['is', 'is empty', 'is not empty'];

// Agent fields support multiselect (comma-separated UUIDs), so they get their own set
const VALID_AGENT_CONDITIONS: FilterCondition[] = [
  'is',
  'is not',
  'contain',
  'does not contain',
  'is empty',
  'is not empty',
];

function validateCondition(
  fieldId: string,
  fieldType: string,
  condition: FilterCondition
): void {
  const agentFields = ['assignedTo', 'createdBy'];

  let valid: FilterCondition[];

  if (agentFields.includes(fieldId)) {
    valid = VALID_AGENT_CONDITIONS;
  } else if (fieldType === 'string') {
    valid = VALID_STRING_CONDITIONS;
  } else if (fieldType === 'date') {
    valid = VALID_DATE_CONDITIONS;
  } else if (fieldType === 'number') {
    valid = VALID_NUMBER_CONDITIONS;
  } else if (fieldType === 'boolean') {
    valid = VALID_BOOLEAN_CONDITIONS;
  } else {
    throw new BadRequestError(`Unknown fieldType: "${fieldType}"`);
  }

  if (!valid.includes(condition)) {
    throw new BadRequestError(
      `Condition "${condition}" is not valid for field "${fieldId}" (type: ${fieldType}). ` +
        `Valid conditions: ${valid.join(', ')}`
    );
  }
}

// Reject dates that aren't YYYY-MM-DD — Postgres will cast them but silently produce wrong results
function validateDate(value: string, fieldId: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new BadRequestError(
      `Invalid date format for field "${fieldId}": "${value}". Expected YYYY-MM-DD.`
    );
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new BadRequestError(
      `Invalid date value for field "${fieldId}": "${value}".`
    );
  }
}

function buildStringClause(column: string, condition: FilterCondition, value?: string): SqlClause {
  switch (condition) {
    case 'is empty':
      return { sql: `(${column} IS NULL OR ${column} = '')`, bindings: [] };

    case 'is not empty':
      return { sql: `(${column} IS NOT NULL AND ${column} != '')`, bindings: [] };

    default:
      if (value === undefined || value === '') {
        throw new BadRequestError(`Condition "${condition}" requires a value for field`);
      }
  }

  switch (condition) {
    case 'is':
      return { sql: `LOWER(${column}) = LOWER(?)`, bindings: [value] };

    case 'is not':
      return {
        sql: `(${column} IS NULL OR LOWER(${column}) != LOWER(?))`,
        bindings: [value],
      };

    case 'contain':
      return { sql: `${column} ILIKE ?`, bindings: [`%${value}%`] };

    case 'does not contain':
      return {
        sql: `(${column} IS NULL OR ${column} NOT ILIKE ?)`,
        bindings: [`%${value}%`],
      };

    case 'starts with':
      return { sql: `${column} ILIKE ?`, bindings: [`${value}%`] };

    case 'ends with':
      return { sql: `${column} ILIKE ?`, bindings: [`%${value}`] };

    default:
      throw new BadRequestError(`Unsupported string condition: "${condition}"`);
  }
}

function buildDateClause(column: string, condition: FilterCondition, value?: string): SqlClause {
  switch (condition) {
    case 'is empty':
      return { sql: `${column} IS NULL`, bindings: [] };

    case 'is not empty':
      return { sql: `${column} IS NOT NULL`, bindings: [] };

    default:
      if (!value) {
        throw new BadRequestError(`Condition "${condition}" requires a date value`);
      }
      validateDate(value, column);
  }

  switch (condition) {
    case 'is':
      // Cast both sides to date to ignore time component
      return { sql: `${column}::date = ?::date`, bindings: [value] };

    case 'before':
      return { sql: `${column} < ?`, bindings: [value] };

    case 'after':
      return { sql: `${column} > ?`, bindings: [value] };

    default:
      throw new BadRequestError(`Unsupported date condition: "${condition}"`);
  }
}

/**
 * Agent fields (assignedTo) can be multiselect — the value comes in as
 * comma-separated UUIDs like "uuid1,uuid2". We split and use = ANY(?) for
 * the IN-style check, which plays nicely with Postgres array bindings via pg driver.
 */
function buildAgentClause(column: string, condition: FilterCondition, value?: string, inputType?: string): SqlClause {
  switch (condition) {
    case 'is empty':
      return { sql: `${column} IS NULL`, bindings: [] };

    case 'is not empty':
      return { sql: `${column} IS NOT NULL`, bindings: [] };

    default:
      if (!value) {
        throw new BadRequestError(`Condition "${condition}" requires a value for agent field`);
      }
  }

  const isMultiselect =
    inputType === 'multiselect' || (value?.includes(',') ?? false);
  const uuids = value!.split(',').map((v) => v.trim()).filter(Boolean);

  switch (condition) {
    case 'is':
    case 'contain':
      if (isMultiselect && uuids.length > 1) {
        return { sql: `${column} = ANY(?)`, bindings: [uuids] };
      }
      return { sql: `${column} = ?`, bindings: [uuids[0]] };

    case 'is not':
    case 'does not contain':
      if (isMultiselect && uuids.length > 1) {
        return {
          sql: `(${column} IS NULL OR ${column} != ALL(?))`,
          bindings: [uuids],
        };
      }
      return {
        sql: `(${column} IS NULL OR ${column} != ?)`,
        bindings: [uuids[0]],
      };

    default:
      throw new BadRequestError(`Unsupported agent condition: "${condition}"`);
  }
}

/**
 * Custom fields are stored in a separate EAV table (lead_custom_field_values).
 * We use EXISTS subqueries so filtering doesn't duplicate rows if a lead has
 * multiple custom fields. Each filter gets its own correlated subquery.
 */
function buildCustomFieldClause(
  fieldId: string,
  fieldType: string,
  condition: FilterCondition,
  value?: string
): SqlClause {
  const baseExists = `EXISTS (
    SELECT 1 FROM lead_custom_field_values lcfv
    WHERE lcfv.lead_id = leads.id
      AND lcfv.field_id = ?`;

  const baseNotExists = `NOT EXISTS (
    SELECT 1 FROM lead_custom_field_values lcfv
    WHERE lcfv.lead_id = leads.id
      AND lcfv.field_id = ?`;

  if (condition === 'is empty') {
    return {
      sql: `(${baseNotExists}\n  )
      OR EXISTS (
        SELECT 1 FROM lead_custom_field_values lcfv
        WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND lcfv.value = ''
      ))`,
      bindings: [fieldId, fieldId],
    };
  }

  if (condition === 'is not empty') {
    return {
      sql: `${baseExists}\n      AND lcfv.value != ''\n  )`,
      bindings: [fieldId],
    };
  }

  if (value === undefined || value === '') {
    throw new BadRequestError(
      `Condition "${condition}" requires a value for custom field ${fieldId}`
    );
  }

  if (fieldType === 'string') {
    switch (condition) {
      case 'is':
        return {
          sql: `${baseExists}\n      AND LOWER(lcfv.value) = LOWER(?)\n  )`,
          bindings: [fieldId, value],
        };
      case 'is not':
        return {
          sql: `(${baseNotExists}\n  )
          OR ${baseExists}\n      AND LOWER(lcfv.value) != LOWER(?)\n  ))`,
          bindings: [fieldId, fieldId, value],
        };
      case 'contain':
        return {
          sql: `${baseExists}\n      AND lcfv.value ILIKE ?\n  )`,
          bindings: [fieldId, `%${value}%`],
        };
      case 'does not contain':
        return {
          sql: `(${baseNotExists}\n  )
          OR ${baseExists}\n      AND lcfv.value NOT ILIKE ?\n  ))`,
          bindings: [fieldId, fieldId, `%${value}%`],
        };
      case 'starts with':
        return {
          sql: `${baseExists}\n      AND lcfv.value ILIKE ?\n  )`,
          bindings: [fieldId, `${value}%`],
        };
      case 'ends with':
        return {
          sql: `${baseExists}\n      AND lcfv.value ILIKE ?\n  )`,
          bindings: [fieldId, `%${value}`],
        };
      default:
        throw new BadRequestError(
          `Condition "${condition}" is not supported for custom string fields`
        );
    }
  }

  if (fieldType === 'number') {
    switch (condition) {
      case 'is':
        return {
          sql: `${baseExists}\n      AND lcfv.value::numeric = ?\n  )`,
          bindings: [fieldId, value],
        };
      case 'is not':
        return {
          sql: `(${baseNotExists}\n  )
          OR ${baseExists}\n      AND lcfv.value::numeric != ?\n  ))`,
          bindings: [fieldId, fieldId, value],
        };
      case 'greater than':
        return {
          sql: `${baseExists}\n      AND lcfv.value::numeric > ?\n  )`,
          bindings: [fieldId, value],
        };
      case 'less than':
        return {
          sql: `${baseExists}\n      AND lcfv.value::numeric < ?\n  )`,
          bindings: [fieldId, value],
        };
      default:
        throw new BadRequestError(
          `Condition "${condition}" is not supported for custom number fields`
        );
    }
  }

  if (fieldType === 'boolean') {
    if (condition === 'is') {
      const normalized = value.toLowerCase();
      if (normalized !== 'true' && normalized !== 'false') {
        throw new BadRequestError(
          `Boolean field value must be "true" or "false", got: "${value}"`
        );
      }
      return {
        sql: `${baseExists}\n      AND LOWER(lcfv.value) = ?\n  )`,
        bindings: [fieldId, normalized],
      };
    }
    throw new BadRequestError(
      `Condition "${condition}" is not supported for custom boolean fields`
    );
  }

  if (fieldType === 'date') {
    validateDate(value, fieldId);
    switch (condition) {
      case 'is':
        return {
          sql: `${baseExists}\n      AND lcfv.value::date = ?::date\n  )`,
          bindings: [fieldId, value],
        };
      case 'before':
        return {
          sql: `${baseExists}\n      AND lcfv.value::date < ?::date\n  )`,
          bindings: [fieldId, value],
        };
      case 'after':
        return {
          sql: `${baseExists}\n      AND lcfv.value::date > ?::date\n  )`,
          bindings: [fieldId, value],
        };
      default:
        throw new BadRequestError(
          `Condition "${condition}" is not supported for custom date fields`
        );
    }
  }

  throw new BadRequestError(`Unsupported custom field type: "${fieldType}"`);
}

/**
 * Entry point — takes the filters array from the request and builds the full
 * boolean predicate (joined by AND or OR depending on the logic field).
 */
export function buildFilterClauses(
  filters: LeadFilter[],
  logic: 'AND' | 'OR'
): SqlClause | null {
  if (!filters || filters.length === 0) return null;

  const parts: SqlClause[] = [];

  for (const filter of filters) {
    const { fieldId, fieldType, condition, value, inputType } = filter;

    validateCondition(fieldId, fieldType, condition);

    let clause: SqlClause;

    if (!SYSTEM_FIELD_IDS.has(fieldId)) {
      // Not a known system field — treat the fieldId as a custom field UUID
      clause = buildCustomFieldClause(fieldId, fieldType, condition, value);
    } else if (fieldId === 'assignedTo' || fieldId === 'createdBy') {
      const column = SYSTEM_FIELD_TO_COLUMN[fieldId];
      clause = buildAgentClause(`leads.${column}`, condition, value, inputType);
    } else if (fieldType === 'date' || fieldId === 'followUpDate' || fieldId === 'createdAt' || fieldId === 'updatedAt') {
      const column = SYSTEM_FIELD_TO_COLUMN[fieldId];
      clause = buildDateClause(`leads.${column}`, condition, value);
    } else {
      const column = SYSTEM_FIELD_TO_COLUMN[fieldId];
      clause = buildStringClause(`leads.${column}`, condition, value);
    }

    parts.push(clause);
  }

  if (parts.length === 0) return null;

  const joinedSql = parts.map((p) => `(${p.sql})`).join(` ${logic} `);
  const joinedBindings = parts.flatMap((p) => p.bindings);

  return {
    sql: `(${joinedSql})`,
    bindings: joinedBindings,
  };
}

/** Free-text search across the main identity columns */
export function buildSearchClause(q: string): SqlClause {
  const searchVal = `%${q}%`;
  return {
    sql: `(leads.name ILIKE ? OR leads.phone ILIKE ? OR leads.email ILIKE ? OR leads.e164 ILIKE ?)`,
    bindings: [searchVal, searchVal, searchVal, searchVal],
  };
}
