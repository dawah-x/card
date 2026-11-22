/**
 * DAWAH X AI — Cloudflare Workers AI Hybrid Engine (DAWAH X Priority + Live External Web Search)
 *
 * Powers:
 *  1) Tier 1: Strict DAWAH X Corpus Grounding whenever DAWAH X has the answer
 *  2) Tier 2: Live Multi-Source Web Search (Trusted Islamic Portals + Wikipedia + Open Web) when DAWAH X lacks a direct match
 *  3) Global Cloudflare Edge Cache (`caches.default`) — 0 Neurons & ~15ms latency on repeated questions
 *  4) Neuron-smart 4-model cascade + optional zero-cost Gemini / Groq secret failover
 */

import { gatherExternalWebContext } from './web-search.js';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-AI-Cache, X-AI-Model',
  'Access-Control-Max-Age': '86400',
};

export const MODEL_CASCADE = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/openai/gpt-oss-120b',
  '@cf/google/gemma-3-12b-it',
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
];

const EDGE_CACHE_TTL_SEC = 604800; // 7 days

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function handleHealth(env) {
  const hasAI = Boolean(env && env.AI && typeof env.AI.run === 'function');
  const hasGemini = Boolean(env && env.GEMINI_API_KEY);
  const hasGroq = Boolean(env && env.GROQ_API_KEY);
  return jsonResponse({
    ok: hasAI || hasGemini || hasGroq,
    service: 'dawahx-cloudflare-ai',
    engine: hasAI ? 'cloudflare-workers-ai' : hasGemini || hasGroq ? 'external-free-ai' : 'missing-ai-binding',
    primary_model: MODEL_CASCADE[0],
    fallback_models: MODEL_CASCADE.slice(1),
    backup_providers: [
      ...(hasGroq ? ['groq'] : []),
      ...(hasGemini ? ['gemini'] : []),
    ],
    web_search: true,
    edge_cache: true,
    streaming: true,
    strict_rag: true,
  });
}

function getDhakaDateTimeSummary() {
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      timeZone: 'Asia/Dhaka',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch (_) {
    return '';
  }
}

function isSentenceComplete(txt) {
  const t = String(txt || '').trim();
  return t.length >= 60 && /[।?!.)”'"\]*»﴾]\s*$/u.test(t);
}

async function computeEdgeCacheRequest(mode, question, headline, primaryCite) {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const normQ = String(question || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const rawKey = `v14|${mode}|${normQ}|${String(headline || '').slice(0, 120)}|${String(primaryCite || '').slice(0, 120)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return new Request(`https://cache.dawahx.internal/ai-v14/${hex}`, { method: 'GET' });
  } catch (_) {
    return null;
  }
}

function createSingleAnswerSSE(text, modelUsed, cacheStatus = 'MISS', webSources = []) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (Array.isArray(webSources) && webSources.length > 0) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ web_sources: webSources })}\n\n`));
      }
      if (text) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text, model: modelUsed })}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-AI-Cache': cacheStatus,
      'X-AI-Model': modelUsed,
    },
  });
}

function buildMessages({
  question,
  mode,
  history,
  ragContext,
  evidences,
  headline,
  primaryVerdict,
  partialAnswer,
  webContext,
  isIslamicTopic,
}) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 3) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 3) : [];
  const cleanHeadline = String(headline || '').trim().slice(0, 260);
  const cleanVerdict = String(primaryVerdict || '').trim().slice(0, 900);
  const cleanPartial = String(partialAnswer || '').trim().slice(-1400);
  const cleanWebCtx = String(webContext || '').trim().slice(0, 4200);

  let inheritedContext = '';
  if (safeRag.length === 0 && safeHistory.length > 0) {
    for (let i = safeHistory.length - 1; i >= 0; i--) {
      const h = safeHistory[i];
      if (h && h.role === 'assistant' && (h.primary_title || h.extra_body || (h.sources && h.sources.length))) {
        const parts = [];
        if (h.primary_title) parts.push(`শিরোনাম: ${String(h.primary_title).slice(0, 220)}`);
        if (h.text) parts.push(`মূল উত্তর: ${String(h.text).slice(0, 750)}`);
        if (h.extra_body) parts.push(`অতিরিক্ত বিবরণ: ${String(h.extra_body).slice(0, 950)}`);
        if (Array.isArray(h.evidences) && h.evidences.length > 0) {
          parts.push(
            'উদ্ধৃত দলিল:\n' +
              h.evidences
                .slice(0, 3)
                .map((e) => `- ${String(e.text || '').slice(0, 350)} (${String(e.source_name || 'DAWAH X')})`)
                .join('\n')
          );
        }
        inheritedContext = parts.join('\n');
        break;
      }
    }
  }

  let systemPrompt = '';
  let userContent = '';
  let temperature = 0.22;
  let maxTokens = 2200;

  if (mode === 'continue' && cleanPartial) {
    temperature = 0.12;
    maxTokens = 1400;
    systemPrompt =
      'তুমি "DAWAH X AI"। একটি উত্তরের শেষ অংশটুকু টোকেন সীমার কারণে বাক্যের মাঝপথে থেমে গেছে।\n' +
      'তোমার একমাত্র কাজ হলো আগের লেখা পুনরাবৃত্তি না করে ঠিক যেখানে থেমেছে সেখান থেকে বাকি অংশটুকু স্বাভাবিকভাবে যুক্ত করে পরিপূর্ণ বাক্যে উত্তরটি শেষ করা। কোনো ভূমিকা বা "নিচে বাকি অংশ" লিখবে না—সরাসরি পরের শব্দ থেকে শুরু করবে।';
    const firstRagBody = safeRag.length > 0 ? String(safeRag[0].content || safeRag[0].excerpt || '').slice(0, 2000) : '';
    const refText = firstRagBody ? `\n\nমূল দলিল:\n${firstRagBody}` : '';
    userContent =
      `মূল প্রশ্ন: ${cleanQ}${refText}\n\n` +
      `এ পর্যন্ত লেখা অসমাপ্ত অংশ:\n${cleanPartial}\n\n` +
      `ঠিক যেখানে থেমেছে সেখান থেকে বাকি অংশটুকু লিখে সম্পূর্ণ বাক্যে শেষ করো:`;
  } else if (mode === 'grounded' && safeRag.length > 0) {
    temperature = 0.12;
    maxTokens = 2800;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/)-এর দলিলভিত্তিক ইসলামিক ও জ্ঞানমূলক প্রশ্নোত্তর এআই।\n' +
      'ব্যবহারকারীর প্রশ্নের সাথে DAWAH X সংগ্রহের যাচাইকৃত ফতোয়া ও দলিলের সরাসরি মিল পাওয়া গেছে। নিচে প্রদত্ত DAWAH X ফতোয়া, প্রবন্ধ ও দলিলের আলোকে একদম স্পষ্ট, প্রামাণ্য, প্রাঞ্জল ও পরিপূর্ণ উত্তর প্রদান করো।\n\n' +
      'উত্তর লেখার নীতিমালা:\n' +
      '১. শতভাগ দলিলনির্ভরতা: প্রদত্ত "মূল ফতোয়ার সিদ্ধান্ত" ও DAWAH X উদ্ধৃতির বিপরীতে কোনো মনগড়া ফতোয়া বা বানানো হাদীস নম্বর যোগ করবে না।\n' +
      '২. সরাসরি মূল উত্তর দিয়ে শুরু: প্রথম অনুচ্ছেদেই প্রশ্নকারীর নির্দিষ্ট প্রশ্নের সরাসরি ও স্পষ্ট হুকুম/উত্তর লিখবে।\n' +
      '৩. সুসংহত ব্যাখ্যা ও দলিল: সংক্ষিপ্ত অনুচ্ছেদ বা • বুলেট পয়েন্টে শর্তাবলি ও দলিল তুলে ধরবে এবং পাশে [১], [২] সূত্র নম্বর উল্লেখ করবে।\n' +
      '৪. পরিপূর্ণ সমাপ্তি ও বিশুদ্ধ বাংলা: উত্তরটি অবশ্যই পরিপূর্ণ বাক্যে শেষ করবে—কখনোই বাক্য অসমাপ্ত রেখে থামবে না। বিশুদ্ধ বাংলা লিপি ব্যবহার করবে (কাঁচা HTML ট্যাগ বা অপ্রয়োজনীয় # চিহ্ন এড়িয়ে চলবে)। গুরুত্বপূর্ণ শব্দ **বোল্ড** করতে পারো।';

    const ctxBlocks = safeRag
      .map((c, idx) => {
        const cite = String(
          c.citation || `[${idx + 1}] ${c.title || ''} (${c.source || 'DAWAH X'})`
        ).slice(0, 240);
        const charBudget = idx === 0 ? 2200 : 850;
        const body = String(c.content || c.excerpt || '').slice(0, charBudget);
        return `${cite}\n${body}`;
      })
      .join('\n\n---\n\n');

    const verdictHeader =
      (cleanHeadline ? `মূল ফতোয়ার শিরোনাম: ${cleanHeadline}\n` : '') +
      (cleanVerdict ? `মূল ফতোয়ার সিদ্ধান্ত: ${cleanVerdict}\n\n` : '');

    const dalilBlock =
      safeEvidences.length > 0
        ? '\n\nমূল ফতোয়ায় উদ্ধৃত কুরআন ও হাদীসের দলিল:\n' +
          safeEvidences
            .map((ev) => `• ${String(ev.text || '').slice(0, 350)} (${String(ev.source_name || 'DAWAH X')})`)
            .join('\n')
        : '';

    userContent =
      `প্রশ্ন:\n${cleanQ}\n\n` +
      `${verdictHeader}` +
      `DAWAH X তথ্যভাণ্ডার থেকে প্রাপ্ত প্রাসঙ্গিক ফতোয়া ও দলিল:\n${ctxBlocks}${dalilBlock}\n\n` +
      `উপরের DAWAH X দলিল ও মূল সিদ্ধান্তের আলোকে প্রশ্নটির সরাসরি, পরিপূর্ণ ও সুসংহত উত্তর লেখো (অবশ্যই সম্পূর্ণ বাক্যে শেষ করবে):`;
  } else if (mode === 'web_search') {
    const dhakaNow = getDhakaDateTimeSummary();
    temperature = isIslamicTopic ? 0.16 : 0.25;
    maxTokens = 2600;

    if (cleanWebCtx) {
      systemPrompt =
        'তুমি "DAWAH X AI" — একটি প্রামাণ্য ইসলামিক ও সার্বজনীন জ্ঞানভিত্তিক বাংলা এআই সহকারী।\n' +
        (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
        'এই প্রশ্নটির সরাসরি উত্তর DAWAH X-এর নিজস্ব সংগ্রহে না থাকায় ইন্টারনেটের অন্যান্য নির্ভরযোগ্য ওয়েবসাইট ও প্রামাণ্য উৎস থেকে তথ্য অনুসন্ধান করে নিচে দেওয়া হয়েছে।\n\n' +
        'উত্তর লেখার নির্দেশনা:\n' +
        '১. নিচে প্রদত্ত ওয়েব সূত্রগুলোর সঠিক তথ্য ও দলিলের আলোকে একদম স্পষ্ট, নির্ভুল ও পরিপূর্ণ উত্তর দাও এবং প্রাসঙ্গিক তথ্যের পাশে [১], [২] সূত্র নম্বর বা ওয়েবসাইটের নাম উল্লেখ করো।\n' +
        '২. ইসলামিক মাসআলা বা শরঈ প্রশ্নের ক্ষেত্রে কুরআন, সহীহ হাদীস ও আহলুস সুন্নাহ ওয়াল জামাআতের নির্ভরযোগ্য আলেমদের দলিলভিত্তিক মত অনুসরণ করো; কখনোই মনগড়া হাদীস নম্বর বা বানোয়াট দলিল লিখবে না। আলেমদের মধ্যে প্রসিদ্ধ মতভেদ থাকলে সংক্ষেপে সম্মানজনকভাবে উল্লেখ করো।\n' +
        '৩. সাধারণ জ্ঞান, বিজ্ঞান, প্রযুক্তি, ইতিহাস বা দৈনন্দিন প্রশ্নের ক্ষেত্রে সহজ, প্রাঞ্জল ও তথ্যবহুল উত্তর দাও।\n' +
        '৪. "প্রদত্ত তথ্যে পাওয়া যায়নি" বলে উত্তর এড়িয়ে যাবে না—প্রদত্ত ওয়েব সূত্র ও প্রতিষ্ঠিত সত্য জ্ঞানের সমন্বয়ে পূর্ণাঙ্গ উত্তর দিয়ে পরিপূর্ণ বাক্যে শেষ করো। বিশুদ্ধ বাংলা লিপি ব্যবহার করবে (ব্যবহারকারী ইংরেজিতে চাইলে ইংরেজিতে)।';

      userContent =
        `ব্যবহারকারীর প্রশ্ন:\n${cleanQ}\n\n` +
        `অন্যান্য নির্ভরযোগ্য ওয়েবসাইট থেকে প্রাপ্ত তথ্যসূত্র:\n${cleanWebCtx}\n\n` +
        `উপরের নির্ভরযোগ্য সূত্র ও প্রামাণ্য তথ্যের আলোকে প্রশ্নটির স্পষ্ট, নির্ভুল ও পরিপূর্ণ উত্তর লেখো (অবশ্যই সম্পূর্ণ বাক্যে শেষ করবে):`;
    } else {
      systemPrompt =
        'তুমি "DAWAH X AI" — একটি প্রামাণ্য ইসলামিক ও সার্বজনীন জ্ঞানভিত্তিক বাংলা এআই সহকারী।\n' +
        (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
        'ব্যবহারকারীর প্রশ্নটির সরাসরি, নির্ভুল, তথ্যবহুল ও পরিপূর্ণ উত্তর দাও।\n' +
        'নির্দেশনা:\n' +
        '১. ইসলামিক আকীদা, ফিকহ বা মাসআলার প্রশ্ন হলে কুরআনুল কারীম, সহীহ সুন্নাহ ও আহলুস সুন্নাহ ওয়াল জামাআতের সর্বজনবিদিত ও বিশুদ্ধ দলিলের আলোকে উত্তর দাও। নিশ্চিত না হলে কখনোই অনুমান করে হাদীস নম্বর বা অপ্রমাণিত ফতোয়া বানিয়ে লিখবে না।\n' +
        '২. সাধারণ জ্ঞান, বিজ্ঞান, শিক্ষা, প্রযুক্তি বা ভাষাগত প্রশ্ন হলে একদম স্পষ্ট ও প্রাঞ্জলভাবে পূর্ণাঙ্গ উত্তর দাও।\n' +
        '৩. বিশুদ্ধ বাংলায় (বা ব্যবহারকারী ইংরেজিতে চাইলে ইংরেজিতে) গোছানো অনুচ্ছেদ ও • বুলেট পয়েন্টে লিখে অবশ্যই সম্পূর্ণ বাক্যে উত্তর শেষ করো।';

      userContent = `ব্যবহারকারীর প্রশ্ন:\n${cleanQ}`;
    }
  } else {
    const dhakaNow = getDhakaDateTimeSummary();
    temperature = 0.32;
    maxTokens = 2048;
    systemPrompt =
      'তুমি "DAWAH X AI" — বুদ্ধিদীপ্ত, বন্ধুসুলভ, প্রামাণ্য ও রুচিশীল বাংলা এআই সহকারী।\n' +
      (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
      'তোমার বৈশিষ্ট্য:\n' +
      '১. ব্যবহারকারী সালাম দিলে, কুশল বিনিময় করলে, আগের উত্তরের ফলো-আপ প্রশ্ন করলে ("আরেকটু সহজ করে বোঝাও", "উদাহরণ দাও", "ইংরেজিতে অনুবাদ করো", "সংক্ষেপে বলো") কিংবা যেকোনো সাধারণ বা ইসলামিক প্রশ্ন করলে সাবলীল ও আন্তরিক বাংলায় (বা ইংরেজিতে চাইলে ইংরেজিতে) নির্ভুল ও পূর্ণাঙ্গ উত্তর দাও।\n' +
      '২. পূর্ববর্তী উত্তরের প্রেক্ষাপট দেওয়া থাকলে তার আলোকে ব্যাখ্যা বা অনুবাদ দাও এবং অবশ্যই সম্পূর্ণ বাক্যে উত্তর শেষ করো।\n' +
      '৩. কখনোই বানানো হাদীস নম্বর বা যাচাইহীন নামাজের সময় অনুমান করে লিখবে না এবং বিশুদ্ধ বাংলা লিপি ব্যবহার করবে।';

    userContent = inheritedContext
      ? `পূর্ববর্তী উত্তরের সূত্র ও প্রেক্ষাপট:\n${inheritedContext}\n\nব্যবহারকারীর বর্তমান বার্তা:\n${cleanQ}`
      : cleanQ;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  const isAnaphoricFollowup =
    cleanQ.length <= 52 && /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|^আর\s)/iu.test(cleanQ);
  const historySlice =
    mode === 'continue'
      ? []
      : mode === 'grounded' || mode === 'web_search'
        ? isAnaphoricFollowup
          ? safeHistory.slice(-2)
          : []
        : safeHistory.slice(-6);

  for (const turn of historySlice) {
    if (!turn || !turn.text) continue;
    const role = turn.role === 'user' ? 'user' : 'assistant';
    messages.push({
      role,
      content: String(turn.text).slice(0, 750),
    });
  }

  messages.push({ role: 'user', content: userContent });
  return {
    messages,
    temperature,
    maxTokens,
    isCacheable: historySlice.length === 0 && (mode === 'grounded' || mode === 'web_search'),
  };
}

function extractTokenFromChunkObj(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.response === 'string') return obj.response;
  const delta = obj?.choices?.[0]?.delta?.content;
  if (typeof delta === 'string') return delta;
  const msg = obj?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return msg;
  const gemPart = obj?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof gemPart === 'string') return gemPart;
  return '';
}

function createNormalizedSSEStream(rawStream, modelUsed, onComplete, webSources = []) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let hadError = false;

  return new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      try {
        if (Array.isArray(webSources) && webSources.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ web_sources: webSources })}\n\n`));
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const token = extractTokenFromChunkObj(parsed);
              if (token) {
                accumulated += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, model: modelUsed })}\n\n`)
                );
              }
            } catch (_) {}
          }
        }

        buffer += decoder.decode();
        for (const rawTail of buffer.split(/\r?\n/)) {
          const line = rawTail.trim();
          if (!line.startsWith('data:')) continue;
          const tail = line.slice(5).trim();
          if (tail && tail !== '[DONE]') {
            try {
              const parsed = JSON.parse(tail);
              const token = extractTokenFromChunkObj(parsed);
              if (token) {
                accumulated += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, model: modelUsed })}\n\n`)
                );
              }
            } catch (_) {}
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        if (!hadError && typeof onComplete === 'function') {
          onComplete(accumulated.trim());
        }
      } catch (err) {
        hadError = true;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err?.message || 'stream_error') })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } finally {
        try {
          reader.releaseLock();
        } catch (_) {}
      }
    },
  });
}

async function tryExternalFreeProviders(env, { messages, temperature, maxTokens, wantStream, saveToEdgeCache, webSources }) {
  const providers = [];
  if (env && env.GROQ_API_KEY) {
    providers.push({
      name: 'groq/gpt-oss-120b',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: env.GROQ_API_KEY,
      model: 'openai/gpt-oss-120b',
    });
  }
  if (env && env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini/gemini-2.5-flash',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
    });
  }

  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: wantStream,
        }),
      });
      if (!res.ok) continue;

      if (wantStream && res.body) {
        const normalized = createNormalizedSSEStream(res.body, p.name, saveToEdgeCache, webSources);
        return new Response(normalized, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-AI-Cache': 'MISS',
            'X-AI-Model': p.name,
          },
        });
      }

      const data = await res.json();
      const answer = (extractTokenFromChunkObj(data) || '').trim();
      if (answer) {
        if (saveToEdgeCache) saveToEdgeCache(answer);
        return jsonResponse({ ok: true, answer, model: p.name, web_sources: webSources });
      }
    } catch (_) {}
  }
  return null;
}

export async function handleAIChat(request, env, ctx = null) {
  const hasWorkersAI = Boolean(env && env.AI && typeof env.AI.run === 'function');
  const hasExternalBackup = Boolean(env && (env.GROQ_API_KEY || env.GEMINI_API_KEY));

  if (!hasWorkersAI && !hasExternalBackup) {
    return jsonResponse(
      {
        ok: false,
        error: 'Cloudflare Workers AI binding (env.AI) is not configured on this Worker.',
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: 'Invalid JSON request body.' }, 400);
  }

  const question = String(body?.question || '').trim();
  if (!question) {
    return jsonResponse({ ok: false, error: 'Question is required.' }, 400);
  }

  const wantStream = body?.stream !== false;
  let mode = body?.mode;
  if (mode === 'not_found_islamic' || mode === 'web_fallback') {
    mode = 'web_search';
  } else if (!['grounded', 'chat', 'web_search', 'continue'].includes(mode)) {
    mode = Array.isArray(body?.rag_context) && body.rag_context.length > 0 ? 'grounded' : 'chat';
  }

  const isStandalone =
    mode !== 'continue' &&
    !(question.length <= 52 && /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|^আর\s)/iu.test(question));

  // 1. Check Global Cloudflare Edge Cache FIRST (0 web requests & 0 Neurons on cache hits!)
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const primaryCite = body?.rag_context?.[0]?.citation || body?.rag_context?.[0]?.title || '';
  const cacheReq =
    isStandalone && (mode === 'grounded' || mode === 'web_search') && edgeCache
      ? await computeEdgeCacheRequest(mode, question, body?.headline, primaryCite)
      : null;

  if (cacheReq && edgeCache) {
    try {
      const hit = await edgeCache.match(cacheReq);
      if (hit && hit.ok) {
        const cachedPayload = await hit.json();
        if (cachedPayload && cachedPayload.answer) {
          const cachedWebSources = Array.isArray(cachedPayload.web_sources) ? cachedPayload.web_sources : [];
          if (wantStream) {
            return createSingleAnswerSSE(
              cachedPayload.answer,
              cachedPayload.model || 'edge-cache',
              'HIT',
              cachedWebSources
            );
          }
          return jsonResponse({
            ok: true,
            answer: cachedPayload.answer,
            model: cachedPayload.model,
            mode,
            web_sources: cachedWebSources,
            cached: true,
          });
        }
      }
    } catch (_) {}
  }

  // 2. If DAWAH X had no direct match (`mode === 'web_search'`), search trusted external websites live!
  let webSources = [];
  let webContextBlock = '';
  let isIslamicTopic = false;
  if (mode === 'web_search') {
    try {
      const webData = await gatherExternalWebContext(question, env);
      webSources = webData.sources || [];
      webContextBlock = webData.contextBlock || '';
      isIslamicTopic = Boolean(webData.isIslamic);
    } catch (_) {}
  }

  const { messages, temperature, maxTokens, isCacheable } = buildMessages({
    question,
    mode,
    history: body?.history,
    ragContext: body?.rag_context,
    evidences: body?.evidences,
    headline: body?.headline,
    primaryVerdict: body?.primary_verdict,
    partialAnswer: body?.partial_answer,
    webContext: webContextBlock,
    isIslamicTopic,
  });

  const saveToEdgeCache = (finalAnswer, modelUsed = MODEL_CASCADE[0]) => {
    if (!isCacheable || !cacheReq || !edgeCache || !isSentenceComplete(finalAnswer)) return;
    const putPromise = edgeCache
      .put(
        cacheReq,
        new Response(
          JSON.stringify({
            answer: finalAnswer,
            model: modelUsed,
            web_sources: webSources,
          }),
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': `public, max-age=${EDGE_CACHE_TTL_SEC}`,
            },
          }
        )
      )
      .catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(putPromise);
    }
  };

  // 3. Run Cloudflare Workers AI Cascade
  let lastError = null;
  if (hasWorkersAI) {
    for (const model of MODEL_CASCADE) {
      try {
        const aiResult = await env.AI.run(model, {
          messages,
          stream: wantStream,
          temperature,
          max_tokens: maxTokens,
        });

        if (wantStream) {
          if (aiResult && typeof aiResult.getReader === 'function') {
            const normalized = createNormalizedSSEStream(
              aiResult,
              model,
              (txt) => saveToEdgeCache(txt, model),
              webSources
            );
            return new Response(normalized, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-AI-Cache': 'MISS',
                'X-AI-Model': model,
              },
            });
          }

          const text = (extractTokenFromChunkObj(aiResult) || '').trim();
          if (text) saveToEdgeCache(text, model);
          return createSingleAnswerSSE(text, model, 'MISS', webSources);
        }

        const answer = (extractTokenFromChunkObj(aiResult) || '').trim();
        if (answer) {
          saveToEdgeCache(answer, model);
          return jsonResponse({ ok: true, answer, model, mode, web_sources: webSources });
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  // 4. Automatic Zero-Cost External Failover (if GROQ_API_KEY or GEMINI_API_KEY is configured)
  if (hasExternalBackup) {
    const extRes = await tryExternalFreeProviders(env, {
      messages,
      temperature,
      maxTokens,
      wantStream,
      saveToEdgeCache: (txt) => saveToEdgeCache(txt, 'external-backup'),
      webSources,
    });
    if (extRes) return extRes;
  }

  return jsonResponse(
    {
      ok: false,
      error: String(lastError?.message || 'All AI models failed.'),
    },
    502
  );
}
