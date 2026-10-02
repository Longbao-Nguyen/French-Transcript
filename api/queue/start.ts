import { requireUser } from '../../server/auth/session.js';
import { getRepositories } from '../../server/db/index.js';
import { HttpError, route } from '../../server/http/responses.js';

// Worker creation and Kaggle connection validation belong to Milestones 5–6.
// Never mark a paused queue RUNNING without actually starting a worker.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const repositories = await getRepositories();
  const [state, count] = await Promise.all([
    repositories.queue.getStateForUser(user.id),
    repositories.queue.countQueuedForUser(user.id),
  ]);
  if (state === 'PAUSING') throw new HttpError(409, 'Stopping current worker.', 'QUEUE_PAUSING');
  if (state === 'RUNNING') throw new HttpError(409, 'Queue is already running.', 'QUEUE_RUNNING');
  if (count === 0) throw new HttpError(409, 'No queued jobs remain.', 'QUEUE_EMPTY');
  throw new HttpError(503, 'Kaggle worker connection is not available yet.', 'KAGGLE_NOT_CONNECTED');
});
