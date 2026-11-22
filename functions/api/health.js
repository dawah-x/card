import { handleHealth, handleOptions } from '../../cloudflare/ai-handler.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  return handleHealth(context.env);
}
