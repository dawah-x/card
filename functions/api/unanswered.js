import { handleOptions, handleUnansweredTracker } from '../../cloudflare/ai-handler.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  return handleUnansweredTracker(context.request, context.env, context);
}

export async function onRequestPost(context) {
  return handleUnansweredTracker(context.request, context.env, context);
}
