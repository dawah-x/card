/**
 * DAWAH X AI — Cloudflare Workers AI Strict-RAG, Edge-Cached & Multi-Provider Engine
 *
 * Powers:
 *  1) Global Cloudflare Edge Cache (`caches.default`) — 0 Neurons & ~15ms latency on repeated questions
 *  2) Real-time token streaming (SSE) via Cloudflare Workers AI (`env.AI`)
 *  3) 100% Strict DAWAH X Corpus Grounding for Islamic rulings / fatwas (zero hallucination)
 *  4) Neuron-smart 4-model cascade + optional zero-cost Gemini / Groq secret failover
 */

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
    const rawKey = `v13|${mode}|${normQ}|${String(headline || '').slice(0, 120)}|${String(primaryCite || '').slice(0, 120)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return new Request(`https://cache.dawahx.internal/ai-v13/${hex}`, { method: 'GET' });
  } catch (_) {
    return null;
  }
}

function createSingleAnswerSSE(text, modelUsed, cacheStatus = 'MISS') {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
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

function buildMessages({ question, mode, history, ragContext, evidences, headline, primaryVerdict, partialAnswer }) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 3) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 3) : [];
  const cleanHeadline = String(headline || '').trim().slice(0, 260);
  const cleanVerdict = String(primaryVerdict || '').trim().slice(0, 900);
  const cleanPartial = String(partialAnswer || '').trim().slice(-1400);

  // Pull previous turn's grounded context if user is asking a conversational follow-up ("আরেকটু সহজ করে বোঝাও", "ইংরেজিতে অনুবাদ করো")
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
  let temperature = 0.25;
  let maxTokens = 900;

  if (mode === 'continue' && cleanPartial) {
    temperature = 0.12;
    maxTokens = 1400;
    systemPrompt =
      'তুমি "DAWAH X AI"। একটি উত্তরের শেষ অংশটুকু টোকেন সীমার কারণে বাক্যের মাঝপথে থেমে গেছে।\n' +
      'তোমার একমাত্র কাজ হলো আগের লেখা পুনরাবৃত্তি না করে ঠিক যেখানে থেমেছে সেখান থেকে বাকি অংশটুকু প্রদত্ত DAWAH X তথ্যের আলোকে স্বাভাবিকভাবে যুক্ত করে পরিপূর্ণ বাক্যে উত্তরটি শেষ করা। কোনো ভূমিকা বা "নিচে বাকি অংশ" লিখবে না—সরাসরি পরের শব্দ থেকে শুরু করবে।';
    const firstRagBody = safeRag.length > 0 ? String(safeRag[0].content || safeRag[0].excerpt || '').slice(0, 2000) : '';
    const refText = firstRagBody ? `\n\nমূল DAWAH X দলিল:\n${firstRagBody}` : '';
    userContent =
      `মূল প্রশ্ন: ${cleanQ}${refText}\n\n` +
      `এ পর্যন্ত লেখা অসমাপ্ত অংশ:\n${cleanPartial}\n\n` +
      `ঠিক যেখানে থেমেছে সেখান থেকে বাকি অংশটুকু লিখে সম্পূর্ণ বাক্যে শেষ করো:`;
  } else if (mode === 'grounded' && safeRag.length > 0) {
    temperature = 0.12;
    maxTokens = 2800;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/)-এর অফিসিয়াল দলিলভিত্তিক ইসলামিক প্রশ্নোত্তর এআই।\n' +
      'তোমার একমাত্র কাজ হলো ব্যবহারকারীর প্রশ্নটি গভীরভাবে বুঝে শুধুমাত্র নিচে প্রদত্ত DAWAH X-এর যাচাইকৃত ফতোয়া, প্রবন্ধ ও দলিলের আলোকে একদম স্পষ্ট, প্রামাণ্য, প্রাঞ্জল ও পরিপূর্ণ উত্তর প্রদান করা।\n\n' +
      'উত্তর লেখার কঠোর নীতিমালা:\n' +
      '১. শতভাগ দলিলনির্ভরতা ও সিদ্ধান্তের মিল (Zero Hallucination): নিচে প্রদত্ত "মূল ফতোয়ার সিদ্ধান্ত" ও DAWAH X উদ্ধৃতির বাইরে নিজের থেকে কোনো নতুন ফতোয়া, হাদীস নম্বর, আয়াত বা ব্যক্তিগত অনুমান কখনোই যোগ করবে না এবং মূল ফতোয়ার সিদ্ধান্তের বিপরীত হুকুম কখনোই লিখবে না।\n' +
      '২. সরাসরি মূল উত্তর দিয়ে শুরু: "প্রদত্ত তথ্য অনুযায়ী" বা অপ্রয়োজনীয় ভূমিকা না টেনে প্রথম অনুচ্ছেদেই প্রশ্নকারীর নির্দিষ্ট প্রশ্নের সরাসরি ও স্পষ্ট হুকুম/উত্তর লিখবে।\n' +
      '৩. সুসংহত ব্যাখ্যা ও দলিল: এরপর সংক্ষিপ্ত ও গোছানো অনুচ্ছেদ বা • বুলেট পয়েন্টে শর্তাবলি ও দলিল (কুরআনের আয়াত বা সহীহ হাদীসের অর্থ ও গ্রন্থসূত্রসহ) তুলে ধরবে এবং পাশে [১], [২] সূত্র নম্বর উল্লেখ করবে।\n' +
      '৪. পরিপূর্ণ সমাপ্তি ও বিশুদ্ধ বাংলা: উত্তরটি অবশ্যই পরিপূর্ণ বাক্যে শেষ করবে—কখনোই বাক্য বা পয়েন্ট অসমাপ্ত রেখে থামবে না। বিশুদ্ধ বাংলা লিপি ব্যবহার করবে (কখনোই হিন্দি/দেবনগরী অক্ষর, কাঁচা HTML ট্যাগ বা # চিহ্ন ব্যবহার করবে না)। গুরুত্বপূর্ণ শব্দ **বোল্ড** করতে পারো।';

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
      `উপরের DAWAH X দলিল ও মূল সিদ্ধান্তের সাথে শতভাগ সামঞ্জস্য রেখে প্রশ্নটির সরাসরি, পরিপূর্ণ ও সুসংহত উত্তর লেখো (অবশ্যই সম্পূর্ণ বাক্যে শেষ করবে):`;
  } else if (mode === 'not_found_islamic') {
    temperature = 0.2;
    maxTokens = 900;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X ওয়েবসাইটের আমানতদার ও বিনয়ী ইসলামিক এআই সহকারী।\n' +
      'ব্যবহারকারী একটি নির্দিষ্ট প্রশ্ন করেছেন, কিন্তু DAWAH X-এর বর্তমান ইনডেক্সকৃত ২৪,২০৭+ ফতোয়া ও প্রবন্ধে এই সুনির্দিষ্ট বিষয়ের সরাসরি ফতোয়া পাওয়া যায়নি।\n' +
      'কঠোর নিয়ম:\n' +
      '১. কখনোই নিজের থেকে আন্দাজে কোনো শরঈ হুকুম, হালাল-হারাম ফতোয়া, নামাজের সময়সূচি বা হাদীস বানিয়ে বলবে না।\n' +
      '২. অত্যন্ত আন্তরিক ও সম্মানজনক বাংলায় প্রশ্নকারীকে জানাও যে তাঁর নির্দিষ্ট প্রশ্নটির সরাসরি তথ্য বর্তমান DAWAH X ইনডেক্সে পাওয়া যায়নি এবং দ্বীনি আমানতদারিতার কারণে যাচাইকৃত দলিল ছাড়া অনুমানভিত্তিক উত্তর দেওয়া হয় না।\n' +
      '৩. শরঈ প্রশ্ন হলে নিচে থাকা "✉ শরঈ প্রশ্ন হলে DAWAH X টিমে পাঠান" বাটনে ক্লিক করে সরাসরি বিজ্ঞ আলেমদের কাছে প্রশ্নটি পাঠাতে উৎসাহিত করো এবং সম্পূর্ণ বাক্যে উত্তর শেষ করো।';

    userContent = `ব্যবহারকারীর প্রশ্ন: ${cleanQ}`;
  } else {
    const dhakaNow = getDhakaDateTimeSummary();
    temperature = 0.35;
    maxTokens = 2048;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/) প্ল্যাটফর্মের বুদ্ধিদীপ্ত, বন্ধুসুলভ, মানবিক ও রুচিশীল বাংলা এআই সহকারী।\n' +
      (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
      'তোমার বৈশিষ্ট্য:\n' +
      '১. ব্যবহারকারী সালাম দিলে, কুশল বিনিময় করলে, মানসিক কষ্ট বা হতাশার কথা বললে কিংবা আগের উত্তরের ফলো-আপ প্রশ্ন করলে ("আরেকটু সহজ করে বোঝাও", "উদাহরণ দাও", "ইংরেজিতে অনুবাদ করো", "সংক্ষেপে বলো") একদম মানুষের মতো সাবলীল ও আন্তরিক বাংলায় (বা ব্যবহারকারী ইংরেজিতে বললে ইংরেজিতে) উত্তর দাও।\n' +
      '২. পূর্ববর্তী উত্তরের প্রেক্ষাপট দেওয়া থাকলে শুধুমাত্র সেই তথ্যের আলোকে ব্যাখ্যা বা অনুবাদ দাও এবং অবশ্যই সম্পূর্ণ বাক্যে উত্তর শেষ করো।\n' +
      '৩. কঠোর সতর্কতা: কখনোই নিজের থেকে অনুমান করে নামাজ/ইফতার/সেহরির সময় বা যাচাইহীন শরঈ ফতোয়া বানিয়ে বলবে না এবং বিশুদ্ধ বাংলা লিপি ব্যবহার করবে।\n' +
      '৪. উত্তরে কাঁচা HTML বা অপ্রয়োজনীয় # হেডিং ব্যবহার করবে না।';

    userContent = inheritedContext
      ? `পূর্ববর্তী উত্তরের DAWAH X সূত্র ও প্রেক্ষাপট:\n${inheritedContext}\n\nব্যবহারকারীর বর্তমান বার্তা:\n${cleanQ}`
      : cleanQ;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  const isAnaphoricFollowup =
    cleanQ.length <= 52 && /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|^আর\s)/iu.test(cleanQ);
  const historySlice =
    mode === 'continue' || mode === 'not_found_islamic'
      ? []
      : mode === 'grounded'
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
  return { messages, temperature, maxTokens, isCacheable: historySlice.length === 0 && (mode === 'grounded' || mode === 'not_found_islamic') };
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

function createNormalizedSSEStream(rawStream, modelUsed, onComplete) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let hadError = false;

  return new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      try {
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

        // Flush remaining multi-byte UTF-8 characters in decoder + final buffered line
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

// Optional Zero-Cost External Provider Failover (Groq / Google Gemini OpenAI-compatible endpoints)
async function tryExternalFreeProviders(env, { messages, temperature, maxTokens, wantStream, saveToEdgeCache }) {
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
        const normalized = createNormalizedSSEStream(res.body, p.name, saveToEdgeCache);
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
        return jsonResponse({ ok: true, answer, model: p.name });
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
  const mode = ['grounded', 'chat', 'not_found_islamic', 'continue'].includes(body?.mode)
    ? body.mode
    : Array.isArray(body?.rag_context) && body.rag_context.length > 0
      ? 'grounded'
      : 'chat';

  const { messages, temperature, maxTokens, isCacheable } = buildMessages({
    question,
    mode,
    history: body?.history,
    ragContext: body?.rag_context,
    evidences: body?.evidences,
    headline: body?.headline,
    primaryVerdict: body?.primary_verdict,
    partialAnswer: body?.partial_answer,
  });

  // 1. Check Global Cloudflare Edge Cache (0 Neurons used on cache hits!)
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const primaryCite = body?.rag_context?.[0]?.citation || body?.rag_context?.[0]?.title || '';
  const cacheReq = isCacheable && edgeCache
    ? await computeEdgeCacheRequest(mode, question, body?.headline, primaryCite)
    : null;

  if (cacheReq && edgeCache) {
    try {
      const hit = await edgeCache.match(cacheReq);
      if (hit && hit.ok) {
        const cachedPayload = await hit.json();
        if (cachedPayload && cachedPayload.answer) {
          if (wantStream) {
            return createSingleAnswerSSE(cachedPayload.answer, cachedPayload.model || 'edge-cache', 'HIT');
          }
          return jsonResponse({ ok: true, answer: cachedPayload.answer, model: cachedPayload.model, mode, cached: true });
        }
      }
    } catch (_) {}
  }

  const saveToEdgeCache = (finalAnswer, modelUsed = MODEL_CASCADE[0]) => {
    if (!cacheReq || !edgeCache || !isSentenceComplete(finalAnswer)) return;
    const putPromise = edgeCache
      .put(
        cacheReq,
        new Response(JSON.stringify({ answer: finalAnswer, model: modelUsed }), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${EDGE_CACHE_TTL_SEC}`,
          },
        })
      )
      .catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(putPromise);
    }
  };

  // 2. Run Cloudflare Workers AI Cascade
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
            const normalized = createNormalizedSSEStream(aiResult, model, (txt) => saveToEdgeCache(txt, model));
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
          return createSingleAnswerSSE(text, model, 'MISS');
        }

        const answer = (extractTokenFromChunkObj(aiResult) || '').trim();
        if (answer) {
          saveToEdgeCache(answer, model);
          return jsonResponse({ ok: true, answer, model, mode });
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  // 3. Automatic Zero-Cost External Failover (if GROQ_API_KEY or GEMINI_API_KEY is configured)
  if (hasExternalBackup) {
    const extRes = await tryExternalFreeProviders(env, {
      messages,
      temperature,
      maxTokens,
      wantStream,
      saveToEdgeCache: (txt) => saveToEdgeCache(txt, 'external-backup'),
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
