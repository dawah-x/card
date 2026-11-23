/**
 * DAWAH X AI — Strict DAWAH X-Exclusive Cloudflare Workers AI Engine (v18.0)
 *
 * Strictly answers ONLY from the verified DAWAH X website corpus (https://ebrahim-ead.github.io/DAWAH-X/).
 * Never fetches, cites, or synthesizes answers from any external website or outside source.
 *
 * v18.0 Architecture:
 *  1) Pure unpenalized BPE logit decoding (`temperature: 0.2`, ZERO `frequency_penalty` / `repetition_penalty`
 *     which corrupt Bengali combining vowel marks `া ে ি ্` and cause script drift on quantized FP8 models).
 *  2) Real-time SSE sentence-loop & script-drift guard (stops immediately on any repeated sentence,
 *     Devanagari/Urdu drift, or digit-soup hallucination, trimming cleanly to the last complete `।`).
 *  3) Global Cloudflare Edge Cache (`caches.default`, v18 namespace) — 0 Neurons & ~15ms on repeat grounded queries.
 *  4) Neuron-smart 4-model cascade + optional zero-cost Gemini / Groq secret failover.
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
    version: '18.0',
    engine: hasAI ? 'cloudflare-workers-ai' : hasGemini || hasGroq ? 'external-free-ai' : 'missing-ai-binding',
    primary_model: MODEL_CASCADE[0],
    fallback_models: MODEL_CASCADE.slice(1),
    backup_providers: [
      ...(hasGroq ? ['groq'] : []),
      ...(hasGemini ? ['gemini'] : []),
    ],
    dawahx_only: true,
    web_search: false,
    anti_repetition: 'sentence-stream-guard-v18',
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

export function repairSpacedBengaliMarks(input) {
  let text = String(input || '');
  let prev = '';
  while (text !== prev) {
    prev = text;
    // Collapse any space before a Bengali combining vowel, candrabindu, anusvara, visarga, nukta, or virama
    text = text.replace(
      /([\u0980-\u09FF])[ \t]+([\u0981-\u0983\u09BC\u09BE-\u09CD\u09D7])/gu,
      '$1$2'
    );
  }
  return text;
}

export function detectDegeneracyIndex(text) {
  const s = String(text || '');
  const checks = [
    /[\u0900-\u0963\u0966-\u097F]/u, // Devanagari (Hindi) script drift (excludes shared U+0964 । & U+0965 ॥)
    /[\u0679\u067E\u0686\u0688\u0691\u06AF\u06BA\u06D2]/u, // Urdu-only letters (never in Quranic/Hadith Arabic)
    /[0-9]{10,}/, // 10+ consecutive ASCII digit soup (e.g., 45035503550345035)
    /ايضاً\s*اقرا/u, // Echoed raw cross-link header
  ];
  let earliest = -1;
  for (const re of checks) {
    const m = re.exec(s);
    if (m && (earliest === -1 || m.index < earliest)) {
      earliest = m.index;
    }
  }
  return earliest;
}

export function normalizeSentenceForDedup(s) {
  return String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’'ʼ`ʻ"“”]/g, '')
    .replace(/[ী]/g, 'ি')
    .replace(/[ূ]/g, 'ু')
    .replace(/[ছশষ]/g, 'স')
    .replace(/[ণ]/g, 'ন')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

export function deduplicateAnswerSentences(rawText) {
  let text = repairSpacedBengaliMarks(rawText)
    .replace(/ঠিক\s*যেখান\s*থেকে\s*থেমেছে[^।\n:]*[:।]?\s*/gu, '')
    .trim();

  if (!text) return { text: '', hadLoop: false };

  let hadLoop = false;

  // 1. Cut off immediately before any script-drift / digit-soup degeneracy
  const degenIdx = detectDegeneracyIndex(text);
  if (degenIdx !== -1) {
    text = text.slice(0, degenIdx).trim();
    hadLoop = true;
  }

  if (!text) return { text: '', hadLoop };

  // 2. Sentence-level repetition loop detector
  const segments = text.match(/[^।?!\n]+[।?!]*|\n+/gu) || [text];
  const seen = [];
  const kept = [];

  for (const seg of segments) {
    if (/^\n+$/.test(seg)) {
      kept.push(seg);
      continue;
    }
    const norm = normalizeSentenceForDedup(seg);
    if (norm.length >= 22) {
      const isDup = seen.some((prev) => {
        if (prev === norm) return true;
        if (Math.min(prev.length, norm.length) >= 30 && (prev.includes(norm) || norm.includes(prev))) {
          return true;
        }
        return false;
      });
      if (isDup) {
        hadLoop = true;
        break;
      }
      seen.push(norm);
    }
    kept.push(seg);
  }

  let out = kept.join('').trim();
  if (hadLoop) {
    const lastTerm = Math.max(out.lastIndexOf('।'), out.lastIndexOf('?'), out.lastIndexOf('!'));
    if (lastTerm >= 30) {
      out = out.slice(0, lastTerm + 1).trim();
    }
  }
  return { text: out, hadLoop };
}

function isSentenceComplete(txt) {
  const t = String(txt || '').trim();
  if (t.length < 60) return false;
  if (detectDegeneracyIndex(t) !== -1) return false;
  return /[।?!.)”'"\]*»﴾]\s*$/u.test(t);
}

async function computeEdgeCacheRequest(mode, question, headline, primaryCite) {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const normQ = String(question || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const rawKey = `v18-dawahx-only|${mode}|${normQ}|${String(headline || '').slice(0, 120)}|${String(primaryCite || '').slice(0, 120)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return new Request(`https://cache.dawahx.internal/ai-v18/${hex}`, { method: 'GET' });
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

function sanitizeRagSnippet(raw) {
  return String(raw || '')
    .replace(/ايضاً\s*اقرا[\s\S]*$/u, '')
    .trim();
}

function buildMessages({ question, mode, history, ragContext, evidences, headline, primaryVerdict, partialAnswer }) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 4) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 4) : [];
  const cleanHeadline = String(headline || '').trim().slice(0, 260);
  const cleanVerdict = String(primaryVerdict || '').trim().slice(0, 900);
  const cleanPartial = String(partialAnswer || '').trim().slice(-1100);

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
  let temperature = 0.2;
  let maxTokens = 1400;

  if (mode === 'continue' && cleanPartial) {
    temperature = 0.2;
    maxTokens = 550;
    systemPrompt =
      'তুমি "DAWAH X AI"। নিচের উত্তরের শেষ বাক্যটি অসম্পূর্ণ রয়েছে।\n' +
      'নিয়ম:\n' +
      '১. কোনো ভূমিকা, নির্দেশনা বা আগের বাক্য পুনরাবৃত্তি না করে শুধুমাত্র শেষ অসমাপ্ত বাক্যটুকু প্রমিত বাংলায় অর্থপূর্ণভাবে শেষ করো।\n' +
      '২. বাইরের কোনো ওয়েবসাইটের তথ্য যোগ করবে না।';
    const firstRagBody =
      safeRag.length > 0 ? sanitizeRagSnippet(safeRag[0].content || safeRag[0].excerpt || '').slice(0, 1500) : '';
    const refText = firstRagBody ? `\n\nDAWAH X মূল দলিল:\n${firstRagBody}` : '';
    userContent = `প্রশ্ন: ${cleanQ}${refText}\n\nঅসমাপ্ত উত্তর:\n${cleanPartial}`;
  } else if (mode === 'grounded' && safeRag.length > 0) {
    temperature = 0.2;
    maxTokens = 1400;
    systemPrompt =
      'তুমি "DAWAH X AI" — শুধুমাত্র DAWAH X ওয়েবসাইট (https://ebrahim-ead.github.io/DAWAH-X/)-এর যাচাইকৃত ফতোয়া, প্রবন্ধ ও দলিলের আলোকে উত্তর প্রদানকারী ইসলামিক এআই।\n\n' +
      'কঠোর নীতিমালা (অবশ্যই পালনীয়):\n' +
      '১. শুধুমাত্র DAWAH X নির্ভরতা: নিচে প্রদত্ত DAWAH X-এর উদ্ধৃতি, মূল সিদ্ধান্ত ও দলিলের বাইরে অন্য কোনো ওয়েবসাইট, বাইরের সূত্র বা নিজস্ব অনুমান থেকে কোনো তথ্য, ফতোয়া বা হাদীস নম্বর কখনোই যোগ করবে না।\n' +
      '২. সরাসরি মূল উত্তর দিয়ে শুরু: প্রথম অনুচ্ছেদেই প্রশ্নকারীর নির্দিষ্ট প্রশ্নের সরাসরি ও স্পষ্ট সিদ্ধান্ত জানাবে।\n' +
      '৩. সুসংহত ব্যাখ্যা ও দলিল: সংক্ষিপ্ত অনুচ্ছেদ বা • বুলেট পয়েন্টে শর্তাবলি ও কুরআন-হাদীসের উদ্ধৃত দলিল তুলে ধরবে এবং পাশে [১], [২] সূত্র নম্বর উল্লেখ করবে।\n' +
      '৪. বিশুদ্ধ বাংলা ভাষা: কুরআন-হাদীসের আরবি উদ্ধৃতি ছাড়া সম্পূর্ণ উত্তর বিশুদ্ধ ও প্রমিত বাংলায় লিখবে (হিন্দি বা উর্দু কখনোই ব্যবহার করবে না)। কোনো বাক্য পুনরাবৃত্তি না করে পরিপূর্ণ বাক্যে উত্তর সমাপ্ত করবে।';

    const ctxBlocks = safeRag
      .map((c, idx) => {
        const cite = String(
          c.citation || `[${idx + 1}] ${c.title || ''} (${c.source || 'DAWAH X'})`
        ).slice(0, 240);
        const charBudget = idx === 0 ? 2200 : 1100;
        const body = sanitizeRagSnippet(c.content || c.excerpt || '').slice(0, charBudget);
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
      `DAWAH X ওয়েবসাইট থেকে প্রাপ্ত প্রাসঙ্গিক ফতোয়া ও দলিল:\n${ctxBlocks}${dalilBlock}\n\n` +
      `শুধুমাত্র উপরের DAWAH X দলিল ও মূল সিদ্ধান্তের আলোকে প্রমিত বাংলায় প্রশ্নটির সরাসরি ও সুসংহত উত্তর লেখো:`;
  } else if (mode === 'not_found_islamic') {
    temperature = 0.2;
    maxTokens = 380;
    systemPrompt =
      'তুমি "DAWAH X AI"। ব্যবহারকারী এমন একটি প্রশ্ন করেছেন যার সরাসরি উত্তর DAWAH X ওয়েবসাইটের বর্তমান সংগ্রহে খুঁজে পাওয়া যায়নি।\n' +
      'কঠোর নিয়ম:\n' +
      '১. DAWAH X ওয়েবসাইট ছাড়া অন্য কোনো ওয়েবসাইট বা নিজস্ব জ্ঞান থেকে এই প্রশ্নের কোনো ফতোয়া, তথ্য বা উত্তর কখনোই দেবে না।\n' +
      '২. অত্যন্ত বিনীত ও সংক্ষিপ্ত বাংলায় (২–৩ বাক্যে) জানাবে যে, আমি শুধুমাত্র **DAWAH X** ওয়েবসাইটের যাচাইকৃত সংগ্রহ থেকেই উত্তর প্রদান করি এবং এই নির্দিষ্ট প্রশ্নটির সরাসরি উত্তর বর্তমানে DAWAH X সংগ্রহে পাওয়া যায়নি।\n' +
      '৩. প্রশ্নটি একটু ভিন্ন শব্দে লিখে পুনরায় খোঁজার অথবা নিচের বাটনের মাধ্যমে সরাসরি **DAWAH X টিমে** পাঠানোর অনুরোধ জানাবে। সম্পূর্ণ বাক্যে শেষ করবে।';

    userContent = `ব্যবহারকারীর প্রশ্ন: ${cleanQ}`;
  } else {
    const dhakaNow = getDhakaDateTimeSummary();
    temperature = 0.25;
    maxTokens = 1000;
    systemPrompt =
      'তুমি "DAWAH X AI" — শুধুমাত্র DAWAH X ওয়েবসাইট (https://ebrahim-ead.github.io/DAWAH-X/) ভিত্তিক ইসলামিক প্রশ্নোত্তর সহকারী।\n' +
      (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
      'কঠোর নিয়মাবলি:\n' +
      '১. ব্যবহারকারী সালাম দিলে বা কুশল বিনিময় করলে আন্তরিকভাবে সালামের উত্তর ও কুশল বিনিময় করবে।\n' +
      '২. যদি নিচে "পূর্ববর্তী DAWAH X উত্তরের সূত্র ও প্রেক্ষাপট" দেওয়া থাকে এবং ব্যবহারকারী সেটি সহজ করে বোঝাতে, সংক্ষেপে বলতে বা অনুবাদ করতে বলেন, তবে শুধুমাত্র সেই পূর্ববর্তী DAWAH X উত্তরের তথ্যের ভেতরে থেকেই প্রমিত বাংলায় তা ব্যাখ্যা বা অনুবাদ করবে।\n' +
      '৩. DAWAH X ওয়েবসাইটের বাইরে অন্য কোনো ওয়েবসাইট বা বাইরের উৎস থেকে কোনো ইসলামিক ফতোয়া, মাসআলা বা বাহ্যিক তথ্য কখনোই প্রদান করবে না; DAWAH X প্রেক্ষাপট না থাকলে বিনীতভাবে জানাবে যে তুমি শুধুমাত্র DAWAH X ওয়েবসাইটের সংগ্রহ থেকেই উত্তর দিয়ে থাকো। সম্পূর্ণ বাক্যে শেষ করবে।';

    userContent = inheritedContext
      ? `পূর্ববর্তী DAWAH X উত্তরের সূত্র ও প্রেক্ষাপট:\n${inheritedContext}\n\nব্যবহারকারীর বর্তমান বার্তা:\n${cleanQ}`
      : cleanQ;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  const isAnaphoricFollowup =
    cleanQ.length <= 52 && /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|^আর\s)/iu.test(cleanQ);
  const historySlice =
    mode === 'continue'
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
  return {
    messages,
    temperature,
    maxTokens,
    isCacheable: mode === 'grounded' && historySlice.length === 0 && safeRag.length > 0,
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

function createNormalizedSSEStream(rawStream, modelUsed, onComplete) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let hadError = false;
  let stoppedByLoopGuard = false;

  return new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      try {
        while (!stoppedByLoopGuard) {
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
                const candidate = accumulated + token;
                const shouldInspect =
                  /[।?!\n]/.test(token) || detectDegeneracyIndex(token) !== -1 || detectDegeneracyIndex(candidate) !== -1;

                if (shouldInspect && candidate.length >= 60) {
                  const check = deduplicateAnswerSentences(candidate);
                  if (check.hadLoop) {
                    accumulated = check.text;
                    stoppedByLoopGuard = true;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ replace_text: accumulated, model: modelUsed })}\n\n`)
                    );
                    try {
                      await reader.cancel();
                    } catch (_) {}
                    break;
                  }
                }
                accumulated = candidate;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, model: modelUsed })}\n\n`)
                );
              }
            } catch (_) {}
          }
        }

        if (!stoppedByLoopGuard) {
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
        }

        const finalCheck = deduplicateAnswerSentences(accumulated);
        if (finalCheck.text && finalCheck.text !== accumulated.trim()) {
          accumulated = finalCheck.text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ replace_text: accumulated, model: modelUsed })}\n\n`)
          );
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        if (!hadError && finalCheck.text && typeof onComplete === 'function') {
          onComplete(finalCheck.text);
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
      const rawAns = (extractTokenFromChunkObj(data) || '').trim();
      const answer = deduplicateAnswerSentences(rawAns).text;
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
  let mode = body?.mode;
  if (mode === 'web_search' || mode === 'web_fallback') {
    mode = 'not_found_islamic';
  } else if (!['grounded', 'chat', 'not_found_islamic', 'continue'].includes(mode)) {
    mode = Array.isArray(body?.rag_context) && body.rag_context.length > 0 ? 'grounded' : 'not_found_islamic';
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
  });

  // 1. Check Global Cloudflare Edge Cache (`caches.default`) for grounded DAWAH X queries
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const primaryCite = body?.rag_context?.[0]?.citation || body?.rag_context?.[0]?.title || '';
  const cacheReq =
    isCacheable && edgeCache
      ? await computeEdgeCacheRequest(mode, question, body?.headline, primaryCite)
      : null;

  if (cacheReq && edgeCache) {
    try {
      const hit = await edgeCache.match(cacheReq);
      if (hit && hit.ok) {
        const cachedPayload = await hit.json();
        if (cachedPayload && cachedPayload.answer && detectDegeneracyIndex(cachedPayload.answer) === -1) {
          if (wantStream) {
            return createSingleAnswerSSE(cachedPayload.answer, cachedPayload.model || 'edge-cache', 'HIT');
          }
          return jsonResponse({
            ok: true,
            answer: cachedPayload.answer,
            model: cachedPayload.model,
            mode,
            cached: true,
          });
        }
      }
    } catch (_) {}
  }

  const saveToEdgeCache = (finalAnswer, modelUsed = MODEL_CASCADE[0]) => {
    if (!isCacheable || !cacheReq || !edgeCache || !isSentenceComplete(finalAnswer)) return;
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

  // 2. Run Cloudflare Workers AI Cascade with PURE unpenalized BPE decoding
  // (NEVER pass frequency_penalty or repetition_penalty — they poison frequent Bengali vowel signs `া ে ি ্`)
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
                'X-AI-Cache': 'MISS',
                'X-AI-Model': model,
              },
            });
          }

          const rawFallbackText = String(aiResult?.response || extractTokenFromChunkObj(aiResult) || '').trim();
          const fallbackText = deduplicateAnswerSentences(rawFallbackText).text;
          if (fallbackText) {
            saveToEdgeCache(fallbackText, model);
            return createSingleAnswerSSE(fallbackText, model, 'MISS');
          }
        } else {
          const rawAnswer = String(aiResult?.response || extractTokenFromChunkObj(aiResult) || '').trim();
          const answer = deduplicateAnswerSentences(rawAnswer).text;
          if (answer) {
            saveToEdgeCache(answer, model);
            return jsonResponse({
              ok: true,
              answer,
              model,
              mode,
            });
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  // 3. Optional zero-cost external backup (if GEMINI_API_KEY or GROQ_API_KEY is configured)
  if (hasExternalBackup) {
    const extRes = await tryExternalFreeProviders(env, {
      messages,
      temperature,
      maxTokens,
      wantStream,
      saveToEdgeCache: (txt) => saveToEdgeCache(txt, 'external-free'),
    });
    if (extRes) return extRes;
  }

  return jsonResponse(
    {
      ok: false,
      error: 'AI inference temporarily unavailable.',
      detail: lastError ? String(lastError.message || lastError) : 'all_models_failed',
    },
    502
  );
}
