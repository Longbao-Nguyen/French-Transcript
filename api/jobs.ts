import { requireUser } from '../server/auth/session.js';
import { getRepositories } from '../server/db/index.js';
import { jsonResponse, route } from '../server/http/responses.js';
import { toClientJob } from '../server/jobs/public.js';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const repositories = await getRepositories();
  const jobs = await repositories.jobs.listForUser(user.id, { activeAndRecent: true, limit: 100 });
  const [queueState, queuedCount] = await Promise.all([
    repositories.queue.getStateForUser(user.id),
    repositories.queue.countQueuedForUser(user.id),
  ]);
  return jsonResponse({ jobs: jobs.map(toClientJob), queueState, queuedCount });
});
