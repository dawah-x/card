import { handleOptions, handleVoiceTTS } from '../../cloudflare/ai-handler.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  return handleVoiceTTS(context.request, context.env, context);
}

export async function onRequestPost(context) {
  return handleVoiceTTS(context.request, context.env, context);
}
