import {
  handleAIChat,
  handleHealth,
  handleOptions,
  handleUnansweredTracker,
  handleVoiceSTT,
  handleVoiceTTS,
  jsonResponse,
} from './ai-handler.js';

export default {
  async fetch(request, env, ctx) {
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
        return handleAIChat(request, env, ctx);
      }
      if (path === '/api/stt' && request.method === 'POST') {
        return handleVoiceSTT(request, env);
      }
      if (path === '/api/tts' && (request.method === 'GET' || request.method === 'POST')) {
        return handleVoiceTTS(request, env, ctx);
      }
      if (path === '/api/unanswered' && (request.method === 'GET' || request.method === 'POST')) {
        return handleUnansweredTracker(request, env, ctx);
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
      endpoints: [
        'GET /api/health',
        'POST /api/ai',
        'POST /api/stt',
        'GET/POST /api/tts',
        'GET/POST /api/unanswered',
      ],
    });
  },
};
