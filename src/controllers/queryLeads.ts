/**
 * Controller for POST /api/v1/leads/query.
 *
 * Kept thin on purpose — validates input, calls the service, formats the response.
 * No business logic lives here.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { queryParamsSchema, queryLeadsBodySchema } from '../schemas/queryLeads';
import { queryLeads } from '../services/leads';
import { BadRequestError } from '../errors';
import { LeadFilter } from '../types/leadFilter';

/**
 * Validates the request, runs the query, returns the response.
 */
export async function queryLeadsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate URL query parameters (page, limit, sorting)
    const paramsResult = queryParamsSchema.safeParse(req.query);
    if (!paramsResult.success) {
      const firstError = paramsResult.error.errors[0];
      throw new BadRequestError(firstError.message);
    }
    const params = paramsResult.data;

    // Validate request payload DTO (Filter DSL structure & operators)
    const bodyResult = queryLeadsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      const firstError = bodyResult.error.errors[0];
      const path = firstError.path.join('.');
      throw new BadRequestError(
        path ? `${path}: ${firstError.message}` : firstError.message
      );
    }
    const body = bodyResult.data;

    // Execute core query domain service with Security Principal context
    const result = await queryLeads(
      req.currentUser,
      params,
      {
        q: body.q,
        logic: body.logic,
        filters: body.filters as LeadFilter[],
      }
    );

    // Render standardized HTTP success response envelope
    res.status(200).json({
      status: 'success',
      message: 'Leads fetched successfully',
      data: result.data,
      meta: result.meta,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      next(new BadRequestError(err.errors[0].message));
    } else {
      next(err);
    }
  }
}
