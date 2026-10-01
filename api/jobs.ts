import { requireUser } from '../server/auth/session';
import { getRepositories } from '../server/db';
import { jsonResponse, route } from '../server/http/responses';
import { toClientJob } from '../server/jobs/public';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const repositories = await getRepositories();
  const jobs = await repositories.jobs.listForUser(user.id, { activeAndRecent: true, limit: 100 });
  return jsonResponse({ jobs: jobs.map(toClientJob) });
});
