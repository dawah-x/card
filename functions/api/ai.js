import { handleAIChat, handleOptions } from '../../cloudflare/ai-handler.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  return handleAIChat(context.request, context.env);
}
