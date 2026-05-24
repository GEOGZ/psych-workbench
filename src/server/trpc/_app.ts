import { router } from './trpc';
import { clientsRouter } from './router/clients';
import { projectsRouter } from './router/projects';
import { hatLogRouter } from './router/hat-log';
import { portalRouter } from './router/portal';
import { checklistRouter } from './router/checklist';
import { grantsRouter } from './router/grants';
import { usersRouter } from './router/users';

export const appRouter = router({
  clients: clientsRouter,
  projects: projectsRouter,
  hatLog: hatLogRouter,
  portal: portalRouter,
  checklist: checklistRouter,
  grants: grantsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
