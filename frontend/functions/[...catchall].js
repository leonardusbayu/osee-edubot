export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const path = pathname.replace('/api/', '');
    const workerUrl = `https://edubot-api.edubot-leonardus.workers.dev/api/${path}${url.search}`;

    const headers = {};
    context.request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const workerResponse = await fetch(workerUrl, {
      method: context.request.method,
      headers,
      body: !['GET', 'HEAD'].includes(context.request.method)
        ? await context.request.arrayBuffer()
        : undefined,
    });

    const corsHeaders = new Headers(workerResponse.headers);
    corsHeaders.set('Access-Control-Allow-Origin', url.origin);
    corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-User-Id, x-admin-secret');

    return new Response(workerResponse.body, {
      status: workerResponse.status,
      statusText: workerResponse.statusText,
      headers: corsHeaders,
    });
  }

  return context.next(context.request);
}