/**
 * DAWAH X AI — Verified 3-Source Islamic Knowledge Engine (v19.0)
 *
 * Strictly answers ONLY from the three user-approved verified Islamic sources:
 *   1) DAWAH X (`https://ebrahim-ead.github.io/DAWAH-X/`) — Primary verified corpus
 *   2) Quran.com (`https://quran.com/` via official v4 API) — Verified Arabic & Bengali Quran translations
 *   3) HadithBD / বাংলা হাদিস (`https://www.hadithbd.com/`) — Verified Bengali Hadith & Islamic books
 *
 * Never fetches, cites, or synthesizes answers from any other external website or unverified guesswork.
 * Preserves v18.0 pure unpenalized BPE decoding + real-time sentence-loop & script-drift stream guard.
 */

import { fetchVerifiedExternalIslamicSources } from './external-sources.js';

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
    version: '23.0',
    engine: hasAI ? 'cloudflare-workers-ai' : hasGemini || hasGroq ? 'external-free-ai' : 'missing-ai-binding',
    primary_model: MODEL_CASCADE[0],
    fallback_models: MODEL_CASCADE.slice(1),
    backup_providers: [
      ...(hasGroq ? ['groq'] : []),
      ...(hasGemini ? ['gemini'] : []),
    ],
    verified_sources: [
      'https://ebrahim-ead.github.io/DAWAH-X/',
      'https://quran.com/',
      'https://www.hadithbd.com/',
    ],
    dawahx_collections: {
      quran_surahs: 114,
      hadith_books: 28,
      hadith_records: 61910,
      islamic_book_collections: 10,
      islamic_book_volumes: 102,
      fatwas_and_articles: 24207,
    },
    deep_book_search: true,
    multi_turn_memory: true,
    unanswered_tracker: true,
    tafsir_enabled: true,
    quran_audio_enabled: true,
    voice_stt_enabled: hasAI || hasGroq,
    voice_tts_enabled: true,
    strict_allowlist_only: true,
    anti_repetition: 'sentence-stream-guard-v23',
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
    /[0-9]{10,}/, // 10+ consecutive ASCII digit soup
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

  const degenIdx = detectDegeneracyIndex(text);
  if (degenIdx !== -1) {
    text = text.slice(0, degenIdx).trim();
    hadLoop = true;
  }

  if (!text) return { text: '', hadLoop };

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
    const rawKey = `v23-3sources|${mode}|${normQ}|${String(headline || '').slice(0, 120)}|${String(primaryCite || '').slice(0, 120)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return new Request(`https://cache.dawahx.internal/ai-v23/${hex}`, { method: 'GET' });
  } catch (_) {
    return null;
  }
}

function serializeExternalSourcesForClient(externalSources = []) {
  return (externalSources || []).map((s, idx) => ({
    rank: idx + 1,
    source_site: s.source_site || 'Verified',
    source_name: s.source_name || s.source_site || 'Verified Source',
    title: s.title || '',
    url: s.url || '',
    audio_url: s.audio_url || '',
    arabic: String(s.arabic || '').slice(0, 1200),
    excerpt: String(s.excerpt || '').slice(0, 240),
    full_text: String(s.full_text || s.content || s.excerpt || '').slice(0, 2000),
  }));
}

function createSingleAnswerSSE(text, modelUsed, cacheStatus = 'MISS', metaPayload = null) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (metaPayload && (metaPayload.external_sources?.length || metaPayload.upgraded_grounded)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
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

function sanitizeRagSnippet(raw) {
  return String(raw || '')
    .replace(/ايضاً\s*اقرا[\s\S]*$/u, '')
    .trim();
}

const BN_NUMS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const toBnIdx = (n) => String(n).replace(/\d/g, (d) => BN_NUMS[Number(d)]);

function buildMessages({
  question,
  mode,
  history,
  ragContext,
  externalSources,
  evidences,
  headline,
  primaryVerdict,
  partialAnswer,
}) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 4) : [];
  const safeExt = Array.isArray(externalSources) ? externalSources.slice(0, 4) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 4) : [];
  const cleanHeadline = String(headline || '').trim().slice(0, 260);
  const cleanVerdict = String(primaryVerdict || '').trim().slice(0, 900);
  const cleanPartial = String(partialAnswer || '').trim().slice(-1100);

  let inheritedContext = '';
  if (safeRag.length === 0 && safeExt.length === 0 && safeHistory.length > 0) {
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
  let maxTokens = 1450;

  const hasGroundedSources = safeRag.length > 0 || safeExt.length > 0;

  if (mode === 'continue' && cleanPartial) {
    temperature = 0.2;
    maxTokens = 550;
    systemPrompt =
      'তুমি "DAWAH X AI"। নিচের উত্তরের শেষ বাক্যটি অসম্পূর্ণ রয়েছে।\n' +
      'নিয়ম:\n' +
      '১. কোনো ভূমিকা, নির্দেশনা বা আগের বাক্য পুনরাবৃত্তি না করে শুধুমাত্র শেষ অসমাপ্ত বাক্যটুকু প্রমিত বাংলায় অর্থপূর্ণভাবে শেষ করো।\n' +
      '২. DAWAH X, Quran.com এবং HadithBD-এর প্রদত্ত তথ্যের বাইরে অন্য কোনো উৎসের তথ্য যোগ করবে না।';
    const firstRagBody =
      safeRag.length > 0
        ? sanitizeRagSnippet(safeRag[0].content || safeRag[0].excerpt || '').slice(0, 1400)
        : safeExt.length > 0
          ? String(safeExt[0].content || safeExt[0].excerpt || '').slice(0, 1400)
          : '';
    const refText = firstRagBody ? `\n\nমূল দলিল:\n${firstRagBody}` : '';
    userContent = `প্রশ্ন: ${cleanQ}${refText}\n\nঅসমাপ্ত উত্তর:\n${cleanPartial}`;
  } else if (mode === 'grounded' && hasGroundedSources) {
    temperature = 0.2;
    maxTokens = 1450;
    systemPrompt =
      'তুমি "DAWAH X AI" — শুধুমাত্র তিনটি অনুমোদিত ও যাচাইকৃত ইসলামিক উৎস থেকে উত্তর প্রদানকারী ইসলামিক এআই:\n' +
      '• DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/)\n' +
      '• Quran.com (https://quran.com/)\n' +
      '• HadithBD / বাংলা হাদিস (https://www.hadithbd.com/)\n\n' +
      'কঠোর নীতিমালা (অবশ্যই পালনীয়):\n' +
      '১. অনুমোদিত উৎস নির্ভরতা: নিচে প্রদত্ত DAWAH X, Quran.com ও HadithBD-এর উদ্ধৃতি ও দলিলের বাইরে অন্য কোনো চতুর্থ ওয়েবসাইট বা নিজস্ব অনুমান থেকে কোনো ফতোয়া বা হাদীস নম্বর কখনোই যোগ করবে না।\n' +
      '২. সরাসরি মূল উত্তর দিয়ে শুরু: প্রথম অনুচ্ছেদেই প্রশ্নকারীর নির্দিষ্ট প্রশ্নের সরাসরি ও স্পষ্ট উত্তর জানাবে।\n' +
      '৩. সুসংহত ব্যাখ্যা ও দলিল উল্লেখ: কুরআনের আয়াত ও সহীহ হাদীসের প্রাসঙ্গিক আরবি ও বাংলা অর্থ উল্লেখ করবে, সূরা:আয়াত বা হাদীস গ্রন্থ ও নম্বর লিখবে এবং পাশে [১], [২] সূত্র নম্বর উল্লেখ করবে।\n' +
      '৪. বিশুদ্ধ বাংলা ভাষা: কুরআন-হাদীসের আরবি উদ্ধৃতি ছাড়া সম্পূর্ণ উত্তর বিশুদ্ধ ও প্রমিত বাংলায় লিখবে (হিন্দি বা উর্দু কখনোই ব্যবহার করবে না)। কোনো বাক্য পুনরাবৃত্তি না করে পরিপূর্ণ বাক্যে উত্তর সমাপ্ত করবে।\n' +
      '৫. ধারাবাহিক কথোপকথনের স্মৃতি: যদি আগের বার্তাসমূহে কোনো চলমান আলোচনা থাকে এবং ব্যবহারকারী তার বিশেষ পরিস্থিতি বা পরবর্তী প্রশ্ন (যেমন: "আমার ক্ষেত্রে...", "সফরে থাকলে...", "তাহলে কী করব?") উল্লেখ করেন, তবে পূর্ববর্তী আলোচনার ধারাবাহিকতা বজায় রেখে নিচের যাচাইকৃত দলিলের আলোকে সরাসরি সেই অবস্থার বিধান স্পষ্ট করবে।';

    const numberedBlocks = [];
    let refCounter = 1;

    for (let i = 0; i < safeRag.length; i++) {
      const c = safeRag[i];
      const bnRef = toBnIdx(refCounter++);
      const label = String(c.title || c.citation || '').replace(/^\[\d+\]\s*/, '').slice(0, 200);
      const header = `[${bnRef}] DAWAH X — ${label}${c.source ? ` (${String(c.source)})` : ''}`;
      const budget = i === 0 ? 2100 : 1050;
      const body = sanitizeRagSnippet(c.content || c.excerpt || '').slice(0, budget);
      numberedBlocks.push(`${header}\n${body}`);
    }

    for (let j = 0; j < safeExt.length; j++) {
      const ext = safeExt[j];
      const bnRef = toBnIdx(refCounter++);
      const header = `[${bnRef}] ${ext.source_site || 'Verified'} — ${String(ext.title || '').slice(0, 180)} (${ext.url || ''})`;
      const budget = safeRag.length === 0 && j === 0 ? 1800 : 1150;
      const body = String(ext.content || ext.excerpt || '').slice(0, budget);
      numberedBlocks.push(`${header}\n${body}`);
    }

    const ctxBlocks = numberedBlocks.join('\n\n---\n\n');

    const verdictHeader =
      (cleanHeadline ? `মূল শিরোনাম: ${cleanHeadline}\n` : '') +
      (cleanVerdict ? `মূল সিদ্ধান্ত: ${cleanVerdict}\n\n` : '');

    const dalilBlock =
      safeEvidences.length > 0
        ? '\n\nউদ্ধৃত অতিরিক্ত দলিল:\n' +
          safeEvidences
            .map((ev) => `• ${String(ev.text || '').slice(0, 320)} (${String(ev.source_name || 'DAWAH X')})`)
            .join('\n')
        : '';

    userContent =
      `প্রশ্ন:\n${cleanQ}\n\n` +
      `${verdictHeader}` +
      `যাচাইকৃত তথ্যসূত্র (DAWAH X, Quran.com ও HadithBD):\n${ctxBlocks}${dalilBlock}\n\n` +
      `শুধুমাত্র উপরের যাচাইকৃত দলিলের আলোকে প্রমিত বাংলায় প্রশ্নটির সরাসরি, সুসংহত ও দলিলসমৃদ্ধ উত্তর লেখো:`;
  } else if (mode === 'not_found_islamic') {
    temperature = 0.2;
    maxTokens = 380;
    systemPrompt =
      'তুমি "DAWAH X AI"। ব্যবহারকারী এমন একটি প্রশ্ন করেছেন যার সরাসরি দলিল DAWAH X, Quran.com কিংবা HadithBD-তে এই মুহূর্তে খুঁজে পাওয়া যায়নি।\n' +
      'কঠোর নিয়ম:\n' +
      '১. নিজস্ব অনুমান বা অন্য কোনো অননুমোদিত ওয়েবসাইট থেকে কোনো ফতোয়া বা হাদীস নম্বর কখনোই দেবে না।\n' +
      '২. অত্যন্ত বিনীত ও সংক্ষিপ্ত বাংলায় (২–৩ বাক্যে) জানাবে যে, আমি শুধুমাত্র **DAWAH X**, **Quran.com** ও **HadithBD (বাংলা হাদিস)**-এর যাচাইকৃত সংগ্রহ থেকে উত্তর প্রদান করি এবং এই নির্দিষ্ট প্রশ্নটির সরাসরি দলিল খুঁজে পাওয়া যায়নি।\n' +
      '৩. প্রশ্নটি একটু ভিন্ন শব্দে লিখে পুনরায় খোঁজার অথবা নিচের বাটনের মাধ্যমে সরাসরি **DAWAH X টিমে** পাঠানোর অনুরোধ জানাবে। সম্পূর্ণ বাক্যে শেষ করবে।';

    userContent = `ব্যবহারকারীর প্রশ্ন: ${cleanQ}`;
  } else {
    const dhakaNow = getDhakaDateTimeSummary();
    temperature = 0.25;
    maxTokens = 1000;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/), Quran.com (https://quran.com/) ও HadithBD (https://www.hadithbd.com/) ভিত্তিক ইসলামিক প্রশ্নোত্তর সহকারী।\n' +
      (dhakaNow ? `বর্তমান বাংলাদেশ সময় ও তারিখ (Asia/Dhaka): ${dhakaNow}।\n` : '') +
      'DAWAH X-এর যাচাইকৃত পরিচিতি: পরিচালনায় ইবরাহীম ঈদ (Ebrahim Ead), ফোন ও WhatsApp: 01783543026 (সকাল ১০টা–রাত ১০টা), বিজ্ঞাপনমুক্ত প্ল্যাটফর্ম; বিভাগসমূহ: আল-কুরআন ও তাফসীর (১১৪ সূরা), আল-হাদীস (২৮ গ্রন্থে ৬১,৯১০ হাদীস), ইসলামিক বই (১০ সংগ্রহে ১০২ খণ্ড তাফসীর ও ইতিহাস), ২৪,২০৭+ ফতোয়া ও প্রবন্ধ এবং ৯,৩৩৩+ ভিডিও।\n' +
      'কঠোর নিয়মাবলি:\n' +
      '১. ব্যবহারকারী সালাম দিলে বা কুশল বিনিময় করলে আন্তরিকভাবে সালামের উত্তর ও কুশল বিনিময় করবে।\n' +
      '২. যদি নিচে "পূর্ববর্তী উত্তরের সূত্র ও প্রেক্ষাপট" দেওয়া থাকে এবং ব্যবহারকারী সেটি সহজ করে বোঝাতে, সংক্ষেপে বলতে বা অনুবাদ করতে বলেন, তবে শুধুমাত্র সেই পূর্ববর্তী উত্তরের তথ্যের ভেতরে থেকেই প্রমিত বাংলায় তা ব্যাখ্যা বা অনুবাদ করবে।\n' +
      '৩. DAWAH X, Quran.com ও HadithBD-এর বাইরে অন্য কোনো চতুর্থ ওয়েবসাইট থেকে কোনো ইসলামিক ফতোয়া বা তথ্য কখনোই প্রদান করবে না। সম্পূর্ণ বাক্যে শেষ করবে।';

    userContent = inheritedContext
      ? `পূর্ববর্তী উত্তরের সূত্র ও প্রেক্ষাপট:\n${inheritedContext}\n\nব্যবহারকারীর বর্তমান বার্তা:\n${cleanQ}`
      : cleanQ;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  const isFollowupConversation =
    safeHistory.length >= 2 &&
    cleanQ.length <= 220 &&
    /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|আমার\s*ক্ষেত্রে|আমি\s*যদি|সফরে\s*থাকলে|ভুলে\s*গেলে|মহিলাদের?\s*ক্ষেত্রে|বাচ্চাদের?\s*ক্ষেত্রে|দ্বিতীয়|আরেকটু|বিস্তারিত|সহজ\s*করে|সংক্ষেপে|^আর\s|^কিন্তু\s|^তো\s|^যদি\s)/iu.test(
      cleanQ
    );
  const historySlice =
    mode === 'continue'
      ? []
      : mode === 'grounded'
        ? isFollowupConversation
          ? safeHistory.slice(-6)
          : []
        : safeHistory.slice(-6);

  for (const turn of historySlice) {
    if (!turn || !(turn.ai_answer || turn.text)) continue;
    const role = turn.role === 'user' ? 'user' : 'assistant';
    const contentText = role === 'assistant' ? String(turn.ai_answer || turn.text) : String(turn.text);
    messages.push({
      role,
      content: contentText.slice(0, 750),
    });
  }

  messages.push({ role: 'user', content: userContent });
  return {
    messages,
    temperature,
    maxTokens,
    isCacheable: mode === 'grounded' && historySlice.length === 0 && hasGroundedSources,
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

function createNormalizedSSEStream(rawStream, modelUsed, onComplete, metaPayload = null) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let hadError = false;
  let stoppedByLoopGuard = false;

  return new ReadableStream({
    async start(controller) {
      if (metaPayload && (metaPayload.external_sources?.length || metaPayload.upgraded_grounded)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
      }

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
                  /[।?!\n]/.test(token) ||
                  detectDegeneracyIndex(token) !== -1 ||
                  detectDegeneracyIndex(candidate) !== -1;

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

async function tryExternalFreeProviders(
  env,
  { messages, temperature, maxTokens, wantStream, saveToEdgeCache, metaPayload }
) {
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
        const normalized = createNormalizedSSEStream(res.body, p.name, saveToEdgeCache, metaPayload);
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
        return jsonResponse({
          ok: true,
          answer,
          model: p.name,
          external_sources: metaPayload?.external_sources || [],
          upgraded_grounded: Boolean(metaPayload?.upgraded_grounded),
        });
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
  let initialMode = body?.mode;
  if (initialMode === 'web_search' || initialMode === 'web_fallback') {
    initialMode = 'not_found_islamic';
  } else if (!['grounded', 'chat', 'not_found_islamic', 'continue'].includes(initialMode)) {
    initialMode =
      Array.isArray(body?.rag_context) && body.rag_context.length > 0 ? 'grounded' : 'not_found_islamic';
  }

  // 1. Check Global Cloudflare Edge Cache (`caches.default`) FIRST (0ms external latency & 0 Neurons)
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const primaryCite = body?.rag_context?.[0]?.citation || body?.rag_context?.[0]?.title || '';
  const hasConversationContext =
    Array.isArray(body?.history) &&
    body.history.length >= 2 &&
    question.length <= 220 &&
    /(?:এটা|এটি|ওটা|সেটা|এতে|এর|তাহলে|এক্ষেত্রে|সেক্ষেত্রে|আমার\s*ক্ষেত্রে|আমি\s*যদি|সফরে\s*থাকলে|ভুলে\s*গেলে|মহিলাদের?\s*ক্ষেত্রে|বাচ্চাদের?\s*ক্ষেত্রে|দ্বিতীয়|আরেকটু|বিস্তারিত|সহজ\s*করে|সংক্ষেপে|^আর\s|^কিন্তু\s|^তো\s|^যদি\s)/iu.test(
      question
    );
  const isPotentiallyCacheable =
    (initialMode === 'grounded' || initialMode === 'not_found_islamic') && !hasConversationContext;

  const cacheReq =
    isPotentiallyCacheable && edgeCache
      ? await computeEdgeCacheRequest(initialMode, question, body?.headline, primaryCite)
      : null;

  if (cacheReq && edgeCache && body?.bypass_cache !== true) {
    try {
      const hit = await edgeCache.match(cacheReq);
      if (hit && hit.ok) {
        const cachedPayload = await hit.json();
        if (cachedPayload && cachedPayload.answer && detectDegeneracyIndex(cachedPayload.answer) === -1) {
          const hitMeta = {
            external_sources: cachedPayload.external_sources || [],
            upgraded_grounded: Boolean(cachedPayload.upgraded_grounded),
          };
          if (wantStream) {
            return createSingleAnswerSSE(
              cachedPayload.answer,
              cachedPayload.model || 'edge-cache',
              'HIT',
              hitMeta
            );
          }
          return jsonResponse({
            ok: true,
            answer: cachedPayload.answer,
            model: cachedPayload.model,
            mode: cachedPayload.upgraded_grounded ? 'grounded' : initialMode,
            external_sources: hitMeta.external_sources,
            upgraded_grounded: hitMeta.upgraded_grounded,
            cached: true,
          });
        }
      }
    } catch (_) {}
  }

  // 2. Live Parallel Retrieval from Quran.com (`api.quran.com/api/v4`) & HadithBD (`www.hadithbd.com`)
  let mode = initialMode;
  let externalSources = Array.isArray(body?.external_sources) ? body.external_sources : [];
  let upgradedFromNotFound = false;

  if (
    (mode === 'grounded' || mode === 'not_found_islamic') &&
    externalSources.length === 0 &&
    body?.disable_external_sources !== true
  ) {
    const fetchFn = env && typeof env.FETCH_IMPL === 'function' ? env.FETCH_IMPL : fetch;
    externalSources = await fetchVerifiedExternalIslamicSources(question, fetchFn);
    if (mode === 'not_found_islamic' && externalSources.length > 0) {
      mode = 'grounded';
      upgradedFromNotFound = true;
    }
  }

  // Silently record unanswered Islamic questions so DAWAH X can see what new topics users need
  if (mode === 'not_found_islamic' && !upgradedFromNotFound) {
    const logTask = recordUnansweredQuestion(question, body?.source_filter || 'all', env).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(logTask);
    }
  }

  const clientExtSources = serializeExternalSourcesForClient(externalSources);
  const metaPayload =
    clientExtSources.length > 0 || upgradedFromNotFound
      ? {
          external_sources: clientExtSources,
          upgraded_grounded: upgradedFromNotFound,
        }
      : null;

  const { messages, temperature, maxTokens, isCacheable } = buildMessages({
    question,
    mode,
    history: body?.history,
    ragContext: body?.rag_context,
    externalSources,
    evidences: body?.evidences,
    headline: body?.headline,
    primaryVerdict: body?.primary_verdict,
    partialAnswer: body?.partial_answer,
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
            external_sources: clientExtSources,
            upgraded_grounded: upgradedFromNotFound,
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

  // 3. Run Cloudflare Workers AI Cascade with PURE unpenalized BPE decoding
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
              metaPayload
            );
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
            return createSingleAnswerSSE(fallbackText, model, 'MISS', metaPayload);
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
              external_sources: clientExtSources,
              upgraded_grounded: upgradedFromNotFound,
            });
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  // 4. Optional zero-cost external backup (if GEMINI_API_KEY or GROQ_API_KEY is configured)
  if (hasExternalBackup) {
    const extRes = await tryExternalFreeProviders(env, {
      messages,
      temperature,
      maxTokens,
      wantStream,
      saveToEdgeCache: (txt) => saveToEdgeCache(txt, 'external-free'),
      metaPayload,
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

// ===== Voice Subsystems (v21.0): Speech-to-Text (Whisper) & Bilingual Neural TTS =====

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64) {
  const clean = String(b64 || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

const WHISPER_SILENCE_HALLUCINATIONS = new Set([
  'ধন্যবাদ',
  'ধন্যবাদ।',
  'সাবস্ক্রাইব করুন',
  'সাবস্ক্রাইব করুন।',
  'সাবস্ক্রাইব',
  'লাইক ও সাবস্ক্রাইব করুন',
  'thank you',
  'thank you.',
  'thanks for watching',
  'thanks for watching.',
  'you',
  '.',
  '..',
  '...',
]);

function cleanWhisperTranscript(raw) {
  let txt = String(raw || '')
    .replace(/\[(?:সঙ্গীত|মিউজিক|Music|Applause|Silence|হাসি)\]/giu, '')
    .replace(/\((?:সঙ্গীত|মিউজিক|Music|Applause|Silence)\)/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!txt) return '';
  let prev = '';
  while (txt !== prev) {
    prev = txt;
    txt = txt.replace(
      /([\u0980-\u09FF])[ \t]+([\u0981-\u0983\u09BC\u09BE-\u09CD\u09D7])/gu,
      '$1$2'
    );
  }
  if (WHISPER_SILENCE_HALLUCINATIONS.has(txt.toLowerCase())) return '';
  return txt.trim();
}

export async function handleVoiceSTT(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let audioBytes = null;
  let audioBase64 = '';
  let lang = 'bn';
  let mimeType = 'audio/webm';

  try {
    const ctype = (request.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('application/json')) {
      const body = await request.json();
      const rawAudio = String(body?.audio || '').trim();
      if (!rawAudio) {
        return jsonResponse({ ok: false, error: 'missing_audio' }, 400);
      }
      audioBytes = base64ToUint8(rawAudio);
      audioBase64 = uint8ToBase64(audioBytes);
      if (typeof body?.language === 'string' && /^[a-z]{2}$/i.test(body.language.trim())) {
        lang = body.language.trim().toLowerCase();
      }
      if (typeof body?.mimeType === 'string' && body.mimeType.trim()) {
        mimeType = body.mimeType.trim();
      }
    } else if (ctype.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('audio') || form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse({ ok: false, error: 'missing_audio_file' }, 400);
      }
      const ab = await file.arrayBuffer();
      audioBytes = new Uint8Array(ab);
      audioBase64 = uint8ToBase64(audioBytes);
      const formLang = String(form.get('language') || '').trim();
      if (/^[a-z]{2}$/i.test(formLang)) lang = formLang.toLowerCase();
      if (file.type) mimeType = file.type;
    } else {
      const ab = await request.arrayBuffer();
      audioBytes = new Uint8Array(ab);
      audioBase64 = uint8ToBase64(audioBytes);
      if (ctype.startsWith('audio/')) mimeType = ctype.split(';')[0].trim();
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid_audio_payload', detail: String(err?.message || err) }, 400);
  }

  if (!audioBytes || audioBytes.byteLength < 200) {
    return jsonResponse({ ok: false, error: 'empty_audio' }, 400);
  }
  if (audioBytes.byteLength > 6 * 1024 * 1024) {
    return jsonResponse({ ok: false, error: 'audio_too_large' }, 413);
  }

  const hasWorkersAI = Boolean(env && env.AI && typeof env.AI.run === 'function');
  let lastErr = null;

  if (hasWorkersAI) {
    // 1) Primary multilingual model: @cf/openai/whisper-large-v3-turbo (Base64 audio + Bengali Islamic prompt)
    const turboPayloads = [
      {
        audio: audioBase64,
        task: 'transcribe',
        language: lang,
        vad_filter: true,
        initial_prompt:
          'আসসালামু আলাইকুম। ইসলামিক প্রশ্ন, কুরআন, হাদীস, সালাত, নামাজ, ওযু, রোজা, যাকাত, ফিতরা, দোয়া, সূরা, তাফসীর।',
      },
      {
        audio: audioBase64,
        language: lang,
      },
    ];

    for (const payload of turboPayloads) {
      try {
        const res = await env.AI.run('@cf/openai/whisper-large-v3-turbo', payload);
        if (res && typeof res.text === 'string') {
          const cleaned = cleanWhisperTranscript(res.text);
          return jsonResponse({
            ok: true,
            text: cleaned,
            empty_speech: !cleaned,
            model: '@cf/openai/whisper-large-v3-turbo',
          });
        }
      } catch (e) {
        lastErr = e;
      }
    }

    // 2) Secondary Workers AI Whisper model (@cf/openai/whisper accepts Uint8Array number[])
    try {
      const res = await env.AI.run('@cf/openai/whisper', {
        audio: Array.from(audioBytes),
      });
      if (res && typeof res.text === 'string') {
        const cleaned = cleanWhisperTranscript(res.text);
        return jsonResponse({
          ok: true,
          text: cleaned,
          empty_speech: !cleaned,
          model: '@cf/openai/whisper',
        });
      }
    } catch (e) {
      lastErr = e;
    }
  }

  // 3) Optional Groq Whisper backup if GROQ_API_KEY is configured
  if (env && env.GROQ_API_KEY) {
    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const fd = new FormData();
      fd.append('file', new Blob([audioBytes], { type: mimeType }), `voice.${ext}`);
      fd.append('model', 'whisper-large-v3-turbo');
      fd.append('language', lang);
      const gRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: fd,
      });
      if (gRes.ok) {
        const data = await gRes.json();
        const cleaned = cleanWhisperTranscript(data?.text || '');
        return jsonResponse({
          ok: true,
          text: cleaned,
          empty_speech: !cleaned,
          model: 'groq/whisper-large-v3-turbo',
        });
      }
    } catch (e) {
      lastErr = e;
    }
  }

  return jsonResponse(
    {
      ok: false,
      error: 'stt_unavailable',
      detail: lastErr ? String(lastErr?.message || lastErr) : 'no_stt_provider',
    },
    502
  );
}

function sanitizeTtsSegment(raw) {
  let clean = String(raw || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[[০-৯\d]+\]/g, ' ')
    .replace(/[`~_<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cps = Array.from(clean);
  if (cps.length > 200) {
    clean = cps.slice(0, 200).join('').trim();
  }
  return clean;
}

function resolveTtsLang(requestedLang, text) {
  const req = String(requestedLang || '').trim().toLowerCase();
  if (req === 'ar' || req.startsWith('ar-')) return 'ar';
  if (req === 'en' || req.startsWith('en-')) return 'en';
  const arMatches = text.match(/[\u0600-\u06FF]/g) || [];
  const bnMatches = text.match(/[\u0980-\u09FF]/g) || [];
  if (arMatches.length >= 6 && arMatches.length > bnMatches.length * 1.2) {
    return 'ar';
  }
  return 'bn';
}

export async function handleVoiceTTS(request, env, ctx) {
  let rawText = '';
  let reqLang = 'bn';

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      rawText = url.searchParams.get('q') || url.searchParams.get('text') || '';
      reqLang = url.searchParams.get('tl') || url.searchParams.get('lang') || 'bn';
    } else if (request.method === 'POST') {
      const body = await request.json();
      rawText = body?.text || body?.q || '';
      reqLang = body?.lang || body?.tl || 'bn';
    } else {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }
  } catch (_) {
    return jsonResponse({ ok: false, error: 'invalid_tts_request' }, 400);
  }

  const text = sanitizeTtsSegment(rawText);
  if (!text) {
    return jsonResponse({ ok: false, error: 'empty_text' }, 400);
  }

  const tl = resolveTtsLang(reqLang, text);
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKeyReq = edgeCache
    ? new Request(
        `https://dawahx-tts-cache.local/v21/${tl}?q=${encodeURIComponent(text)}`,
        { method: 'GET' }
      )
    : null;

  if (edgeCache && cacheKeyReq) {
    try {
      const cached = await edgeCache.match(cacheKeyReq);
      if (cached) {
        return new Response(cached.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=604800',
            'X-AI-Cache': 'HIT',
          },
        });
      }
    } catch (_) {}
  }

  const encoded = encodeURIComponent(text);
  const upstreams = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encoded}`,
  ];

  for (const targetUrl of upstreams) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
          Referer: 'https://translate.google.com/',
        },
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) continue;

      const buf = await res.arrayBuffer();
      if (!buf || buf.byteLength < 200) continue;

      const audioHeaders = {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buf.byteLength),
        'Cache-Control': 'public, max-age=604800',
        'X-AI-Cache': 'MISS',
      };

      if (edgeCache && cacheKeyReq) {
        const cacheResp = new Response(buf.slice(0), { status: 200, headers: audioHeaders });
        const p = edgeCache.put(cacheKeyReq, cacheResp).catch(() => {});
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p);
      }

      return new Response(buf, { status: 200, headers: audioHeaders });
    } catch (_) {
      // Try next TTS upstream
    }
  }

  return jsonResponse({ ok: false, error: 'tts_upstream_unavailable' }, 502);
}

// =========================================================================
// Silent Privacy-Safe Unanswered Question Tracker (`GET/POST /api/unanswered`)
// Uses Cloudflare Edge Cache (`caches.default`) + optional `env.UNANSWERED_KV`
// with zero paid dependencies and automatic PII redaction.
// =========================================================================
const UNANSWERED_CACHE_URL = 'https://cache.dawahx.internal/unanswered-log-v23';
const MEM_UNANSWERED_MAP = new Map();

const SECULAR_OOD_FILTER_RE =
  /(?:ম্যাচের?\s*স্কোর|খেলার?\s*স্কোর|লাইভ\s*স্কোর|ক্রিকেট|(?:ট্রেনের?|বাসের?|বিমানের?|লঞ্চের?)\s*(?:টিকেট\s*|টিকিট\s*)?ভাড়া\s*কত|আবহাওয়া\s*কেমন|তাপমাত্রা\s*কত|(?:বিরিয়ানি|খিচুড়ি|কেক|রান্না\s*করার)\s*রেসিপি|(?:পাইথন|পাইথনে|জাভাস্ক্রিপ্ট|রিয়্যাক্ট|প্রোগ্রামিং).*কোড)/iu;

export function sanitizeAnonymousQuestion(rawQuestion) {
  const cleaned = String(rawQuestion || '')
    .replace(/\S+@\S+\.\S+/g, '[ইমেইল গোপন]')
    .replace(/(?:\+?88)?01[3-9]\d{8}/g, '[ফোন গোপন]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  if (cleaned.length < 6) return '';
  if (SECULAR_OOD_FILTER_RE.test(cleaned)) return '';
  return cleaned;
}

async function loadUnansweredStore(env) {
  const merged = new Map();
  for (const [k, v] of MEM_UNANSWERED_MAP.entries()) {
    merged.set(k, { ...v });
  }

  // Merge from Cloudflare Edge Cache if available
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (edgeCache) {
    try {
      const hit = await edgeCache.match(new Request(UNANSWERED_CACHE_URL, { method: 'GET' }));
      if (hit && hit.ok) {
        const list = await hit.json();
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item || !item.norm) continue;
            const prev = merged.get(item.norm);
            if (!prev || (item.count || 1) > (prev.count || 1)) {
              merged.set(item.norm, item);
            }
          }
        }
      }
    } catch (_) {}
  }

  // Also merge from optional Workers KV binding if configured
  if (env && env.UNANSWERED_KV && typeof env.UNANSWERED_KV.get === 'function') {
    try {
      const kvRaw = await env.UNANSWERED_KV.get('unanswered_v23');
      if (kvRaw) {
        const list = JSON.parse(kvRaw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item || !item.norm) continue;
            const prev = merged.get(item.norm);
            if (!prev || (item.count || 1) > (prev.count || 1)) {
              merged.set(item.norm, item);
            }
          }
        }
      }
    } catch (_) {}
  }

  return merged;
}

async function persistUnansweredStore(storeMap, env) {
  const sorted = [...storeMap.values()]
    .sort((a, b) => (b.count || 1) - (a.count || 1) || String(b.last_seen || '').localeCompare(String(a.last_seen || '')))
    .slice(0, 200);

  MEM_UNANSWERED_MAP.clear();
  for (const item of sorted) {
    MEM_UNANSWERED_MAP.set(item.norm, item);
  }

  const serialized = JSON.stringify(sorted);
  const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (edgeCache) {
    try {
      await edgeCache.put(
        new Request(UNANSWERED_CACHE_URL, { method: 'GET' }),
        new Response(serialized, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=2592000',
          },
        })
      );
    } catch (_) {}
  }

  if (env && env.UNANSWERED_KV && typeof env.UNANSWERED_KV.put === 'function') {
    try {
      await env.UNANSWERED_KV.put('unanswered_v23', serialized);
    } catch (_) {}
  }

  return sorted;
}

export async function recordUnansweredQuestion(rawQuestion, filter = 'all', env = null) {
  const safeQ = sanitizeAnonymousQuestion(rawQuestion);
  if (!safeQ) return false;
  const norm = safeQ.toLowerCase();
  const nowIso = new Date().toISOString();

  const store = await loadUnansweredStore(env);
  const existing = store.get(norm);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.last_seen = nowIso;
  } else {
    store.set(norm, {
      norm,
      question: safeQ,
      filter: String(filter || 'all').slice(0, 24),
      count: 1,
      first_seen: nowIso,
      last_seen: nowIso,
    });
  }
  await persistUnansweredStore(store, env);
  return true;
}

export async function handleUnansweredTracker(request, env, ctx = null) {
  if (request.method === 'GET') {
    const store = await loadUnansweredStore(env);
    const items = [...store.values()]
      .sort((a, b) => (b.count || 1) - (a.count || 1) || String(b.last_seen || '').localeCompare(String(a.last_seen || '')))
      .slice(0, 100)
      .map(({ question, filter, count, first_seen, last_seen }) => ({
        question,
        filter,
        count,
        first_seen,
        last_seen,
      }));
    return jsonResponse({
      ok: true,
      service: 'dawahx-unanswered-tracker',
      version: '23.0',
      total_unique: items.length,
      items,
    });
  }

  if (request.method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }
    const recorded = await recordUnansweredQuestion(body?.question, body?.filter || 'all', env);
    return jsonResponse({ ok: true, recorded });
  }

  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

