// Vercel serverless entry point.
// Vercel doesn't run app.listen() — it wraps the exported Express app directly.
// Local dev still uses src/index.ts which calls listen() normally.
import app from '../src/app';

export default app;
