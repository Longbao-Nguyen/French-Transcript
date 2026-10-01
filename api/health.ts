const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
} as const;

export function GET(): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'french-transcript-api',
      architecture: 'serverless',
      milestone: 1,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: JSON_HEADERS,
    },
  );
}
