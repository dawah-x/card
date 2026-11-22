import { handleAIChat, handleHealth, handleOptions, jsonResponse } from './ai-handler.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }
      if (path === '/api/health' && request.method === 'GET') {
        return handleHealth(env);
      }
      if ((path === '/api/ai' || path === '/api/chat') && request.method === 'POST') {
        return handleAIChat(request, env);
      }
      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    }

    // Serve static DAWAH X AI frontend assets when deployed on Cloudflare Workers + Static Assets
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({
      ok: true,
      service: 'DAWAH X AI — Cloudflare Workers AI Endpoint',
      endpoints: ['GET /api/health', 'POST /api/ai'],
    });
  },
};
