// Extends Express's Request type so req.currentUser is available in all route handlers
// after the auth middleware sets it. Without this, TypeScript would throw a type error.

import { CurrentUser } from './leadFilter';

declare global {
  namespace Express {
    interface Request {
      currentUser: CurrentUser;
    }
  }
}
