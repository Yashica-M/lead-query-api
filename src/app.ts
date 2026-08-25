/**
 * Express app configuration.
 * Wires up middleware, routes, and the global error handler.
 * Intentionally kept separate from index.ts so tests can import the app without starting a server.
 */

import express from 'express';
import leadsRouter from './routes/leads';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';

const app = express();

// Attach correlation ID first — before any other middleware reads from the request
app.use(requestId);
app.use(express.json());

// Simple liveness check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/leads', leadsRouter);

// Catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({
    message: 'Route not found',
    statusCode: 404,
  });
});

// Error handler must be last — Express identifies it by the 4-argument signature
app.use(errorHandler);

export default app;
