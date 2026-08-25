/**
 * Server entry point
 */

import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`[${new Date().toISOString()}] Server running in ${env} mode on port ${PORT}`);
  console.log('----------------------------------------------------');
  console.log('🚀 Lead Query API is ready for requests');
  console.log('----------------------------------------------------');
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// When the process is killed (Ctrl+C or deployment), finish current requests
// before shutting down. This prevents cut-off responses.

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
