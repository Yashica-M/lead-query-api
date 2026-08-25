/**
 * src/routes/leads.ts
 * 
 * Route definitions for the /leads resource.
 * Handles incoming search/query requests with mandatory tenant-level authentication.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { queryLeadsController } from '../controllers/queryLeads';

const router = Router();

// Endpoint for paginated, filterable lead searches.
// Enforces tenant scoping and role-based access control via authenticate middleware.
router.post('/query', authenticate, queryLeadsController);

export default router;