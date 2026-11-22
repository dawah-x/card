/**
 * DAWAH X AI — Cloudflare Workers AI Strict-RAG & Conversational Engine
 *
 * Powers:
 *  1) Real-time token streaming (SSE) via Cloudflare Workers AI (`env.AI`)
 *  2) 100% Strict DAWAH X Corpus Grounding for Islamic rulings / fatwas (zero hallucination)
 *  3) Natural, empathetic ChatGPT-caliber Bengali/Banglish/English dialogue for conversation & follow-ups
 *  4) Automatic multi-model failover across Llama 3.3 70B -> Gemma 3 12B -> Llama 3.1 8B
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const MODEL_CASCADE = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/google/gemma-3-12b-it',
  '@cf/meta/llama-3.1-8b-instruct-fast',
];

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
  return jsonResponse({
    ok: hasAI,
    service: 'dawahx-cloudflare-ai',
    engine: hasAI ? 'cloudflare-workers-ai' : 'missing-ai-binding',
    primary_model: MODEL_CASCADE[0],
    fallback_models: MODEL_CASCADE.slice(1),
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

function buildMessages({ question, mode, history, ragContext, evidences, headline, primaryVerdict, partialAnswer }) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 3) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 3) : [];
  const cleanHeadline = String(headline || '').trim().slice(0, 260);
  const cleanVerdict = String(primaryVerdict || '').trim().slice(0, 900);
  const cleanPartial = String(partialAnswer || '').trim().slice(-1400);

  // Pull previous turn's grounded context if user is asking a conversational follow-up ("আরেকটু সহজ করে বোঝাও", "তাহলে আমার কী করণীয়?")
  let inheritedContext = '';
  if (safeRag.length === 0 && safeHistory.length > 0) {
    for (let i = safeHistory.length - 1; i >= 0; i--) {
      const h = safeHistory[i];
      if (h && h.role === 'assistant' && (h.primary_title || h.extra_body || (h.sources && h.sources.length))) {
        const parts = [];
        if (h.primary_title) parts.push(`শিরোনাম: ${String(h.primary_title).slice(0, 220)}`);
        if (h.text) parts.push(`মূল উত্তর: ${String(h.text).slice(0, 700)}`);
        if (h.extra_body) parts.push(`অতিরিক্ত বিবরণ: ${String(h.extra_body).slice(0, 900)}`);
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
    const refText = safeRag.length > 0 ? `\n\nমূল DAWAH X দলিল:\n${String(safeRag[0].content || '').slice(0, 2000)}` : '';
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
        const cite = String(c.citation || `[${idx + 1}]`).slice(0, 240);
        const charBudget = idx === 0 ? 2200 : 850;
        const body = String(c.content || '').slice(0, charBudget);
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
    // Natural intelligent multi-turn conversation & follow-up explanation (`chat` mode)
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

  // In grounded/continue RAG mode, avoid injecting unrelated prior conversation turns unless user explicitly asked a short anaphoric follow-up!
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
  return { messages, temperature, maxTokens };
}

function extractTokenFromChunkObj(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.response === 'string') return obj.response;
  const delta = obj?.choices?.[0]?.delta?.content;
  if (typeof delta === 'string') return delta;
  const msg = obj?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return msg;
  return '';
}

function createNormalizedSSEStream(rawStream, modelUsed) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

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
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, model: modelUsed })}\n\n`)
                );
              }
            } catch (_) {
              // Ignore partial non-JSON keepalive lines
            }
          }
        }

        // Flush any remaining multi-byte UTF-8 characters in decoder + final buffered line
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
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token, model: modelUsed })}\n\n`)
                );
              }
            } catch (_) {}
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
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

export async function handleAIChat(request, env) {
  if (!env || !env.AI || typeof env.AI.run !== 'function') {
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

  const { messages, temperature, maxTokens } = buildMessages({
    question,
    mode,
    history: body?.history,
    ragContext: body?.rag_context,
    evidences: body?.evidences,
    headline: body?.headline,
    primaryVerdict: body?.primary_verdict,
    partialAnswer: body?.partial_answer,
  });

  let lastError = null;
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
          const normalized = createNormalizedSSEStream(aiResult, model);
          return new Response(normalized, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
            },
          });
        }

        // Graceful SSE fallback if model returned a non-stream object
        const text = extractTokenFromChunkObj(aiResult) || '';
        const encoder = new TextEncoder();
        const singleChunkStream = new ReadableStream({
          start(controller) {
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text, model })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(singleChunkStream, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
          },
        });
      }

      const answer = (extractTokenFromChunkObj(aiResult) || '').trim();
      if (answer) {
        return jsonResponse({ ok: true, answer, model, mode });
      }
    } catch (err) {
      lastError = err;
    }
  }

  return jsonResponse(
    {
      ok: false,
      error: String(lastError?.message || 'All Cloudflare Workers AI models failed.'),
    },
    502
  );
}
