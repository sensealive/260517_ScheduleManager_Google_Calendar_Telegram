export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('Telegram GAS proxy OK', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    if (!env.GAS_WEBAPP_URL) {
      return new Response('missing GAS_WEBAPP_URL', { status: 500 });
    }

    if (env.TELEGRAM_SECRET_TOKEN) {
      const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (got !== env.TELEGRAM_SECRET_TOKEN) {
        return new Response('forbidden', { status: 403 });
      }
    }

    const body = await request.text();

    ctx.waitUntil(
      fetch(env.GAS_WEBAPP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
        },
        body,
        redirect: 'follow',
      })
    );

    return new Response('ok', { status: 200 });
  },
};
