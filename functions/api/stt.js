import { handleOptions, handleVoiceSTT } from '../../cloudflare/ai-handler.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  return handleVoiceSTT(context.request, context.env);
}
