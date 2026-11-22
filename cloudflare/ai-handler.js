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

function buildMessages({ question, mode, history, ragContext, evidences }) {
  const cleanQ = String(question || '').trim().slice(0, 1400);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  const safeRag = Array.isArray(ragContext) ? ragContext.slice(0, 5) : [];
  const safeEvidences = Array.isArray(evidences) ? evidences.slice(0, 5) : [];

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

  if (mode === 'grounded' && safeRag.length > 0) {
    temperature = 0.18;
    maxTokens = 950;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/) ওয়েবসাইটের অফিসিয়াল, প্রজ্ঞাবান, বিনয়ী ও আন্তরিক ইসলামিক এআই সহকারী।\n' +
      'তোমার প্রধান দায়িত্ব হলো প্রশ্নকারীর সুনির্দিষ্ট প্রশ্নটি মনোযোগ দিয়ে বুঝে শুধুমাত্র নিচে প্রদত্ত DAWAH X-এর যাচাইকৃত ফতোয়া, প্রবন্ধ ও দলিলের আলোকে অত্যন্ত প্রাঞ্জল, সহজবোধ্য ও গোছানো বাংলায় (অথবা প্রশ্নকারী ইংরেজিতে প্রশ্ন করলে নির্ভুল ইংরেজিতে) উত্তর দেওয়া।\n\n' +
      'কঠোর নিয়মাবলি (অবশ্যই পালনীয়):\n' +
      '১. শতভাগ দলিলনির্ভরতা: প্রদত্ত DAWAH X সূত্রগুলোর বাইরে নিজের থেকে কোনো নতুন শরঈ হুকুম, মনগড়া ফতোয়া, যাচাইবিহীন হাদীস নম্বর বা ব্যক্তিগত মতামত কখনোই যোগ করবে না।\n' +
      '২. প্রশ্নকারীর পরিস্থিতির সাথে সামঞ্জস্য: প্রশ্নকারী ঠিক যে পরিস্থিতি বা সমস্যার কথা বলেছেন, সরাসরি সেটিকে সম্বোধন করে প্রথমে ১–২ বাক্যে স্পষ্ট মূল সমাধান বলবে, এরপর প্রয়োজনে সংক্ষিপ্ত পয়েন্ট আকারে (• চিহ্ন দিয়ে) বিস্তারিত ব্যাখ্যা ও শর্তাবলি তুলে ধরবে।\n' +
      '৩. সূত্র উল্লেখ: প্রাসঙ্গিক তথ্যের পাশে স্বাভাবিক ভঙ্গিতে [১], [২] এভাবে সূত্র নম্বর উল্লেখ করবে।\n' +
      '৪. পরিচ্ছন্ন ফরম্যাট: উত্তরে কখনোই কাঁচা HTML ট্যাগ বা অপ্রয়োজনীয় # হেডিং ব্যবহার করবে না। স্বাভাবিক অনুচ্ছেদ ও • বুলেট পয়েন্ট ব্যবহার করবে।';

    const ctxBlocks = safeRag
      .map((c, idx) => {
        const cite = String(c.citation || `[${idx + 1}]`).slice(0, 240);
        const body = String(c.content || '').slice(0, 1800);
        return `${cite}\n${body}`;
      })
      .join('\n\n---\n\n');

    const dalilBlock =
      safeEvidences.length > 0
        ? '\n\nউদ্ধৃত কুরআন ও হাদীসের দলিল:\n' +
          safeEvidences
            .map((ev) => `• ${String(ev.text || '').slice(0, 420)} (${String(ev.source_name || 'DAWAH X')})`)
            .join('\n')
        : '';

    userContent =
      `ব্যবহারকারীর বর্তমান প্রশ্ন:\n${cleanQ}\n\n` +
      `DAWAH X তথ্যভাণ্ডার থেকে প্রাপ্ত প্রাসঙ্গিক দলিল ও ফতোয়া:\n${ctxBlocks}${dalilBlock}\n\n` +
      `উপরের DAWAH X দলিলগুলোর আলোকে প্রশ্নকারীর প্রশ্নের সরাসরি, আন্তরিক ও সুবিন্যস্ত উত্তর দাও:`;
  } else if (mode === 'not_found_islamic') {
    temperature = 0.25;
    maxTokens = 480;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X ওয়েবসাইটের আমানতদার ও বিনয়ী ইসলামিক এআই সহকারী।\n' +
      'ব্যবহারকারী একটি নির্দিষ্ট শরঈ/ইসলামিক প্রশ্ন করেছেন, কিন্তু DAWAH X-এর বর্তমান ইনডেক্সকৃত ২৪,২০৭+ ফতোয়া ও প্রবন্ধে এই সুনির্দিষ্ট মাসআলার সরাসরি ফতোয়া পাওয়া যায়নি।\n' +
      'কঠোর নিয়ম:\n' +
      '১. কখনোই নিজের থেকে আন্দাজে কোনো শরঈ হুকুম, হালাল-হারাম ফতোয়া বা হাদীস বানিয়ে বলবে না।\n' +
      '২. অত্যন্ত আন্তরিক ও সম্মানজনক বাংলায় প্রশ্নকারীকে জানাও যে তাঁর নির্দিষ্ট প্রশ্নটির সরাসরি ফতোয়া বর্তমান DAWAH X ইনডেক্সে পাওয়া যায়নি এবং দ্বীনি আমানতদারিতার কারণে যাচাইকৃত দলিল ছাড়া অনুমানভিত্তিক ফতোয়া দেওয়া হয় না।\n' +
      '৩. তাঁকে বিনয়ের সাথে নিচে থাকা "✉ শরঈ প্রশ্ন হলে DAWAH X টিমে পাঠান" বাটনে ক্লিক করে সরাসরি বিজ্ঞ আলেমদের কাছে প্রশ্নটি পাঠাতে উৎসাহিত করো অথবা মূল শব্দ পরিবর্তন করে পুনরায় খুঁজে দেখতে বলো।';

    userContent = `ব্যবহারকারীর প্রশ্ন: ${cleanQ}`;
  } else {
    // Natural intelligent multi-turn conversation & follow-up explanation (`chat` mode)
    temperature = 0.42;
    maxTokens = 780;
    systemPrompt =
      'তুমি "DAWAH X AI" — DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/) প্ল্যাটফর্মের বুদ্ধিদীপ্ত, বন্ধুসুলভ, মানবিক ও রুচিশীল বাংলা এআই সহকারী।\n' +
      'তোমার বৈশিষ্ট্য:\n' +
      '১. ব্যবহারকারী সালাম দিলে, কুশল বিনিময় করলে, মানসিক কষ্ট বা হতাশার কথা বললে, পড়াশোনা/দৈনন্দিন জীবন নিয়ে কথা বললে কিংবা আগের উত্তরের ফলো-আপ প্রশ্ন করলে ("আরেকটু সহজ করে বোঝাও", "উদাহরণ দাও", "ইংরেজিতে অনুবাদ করো", "সংক্ষেপে বলো") একদম মানুষের মতো সাবলীল, বুদ্ধিদীপ্ত ও আন্তরিক বাংলায় (বা ব্যবহারকারী ইংরেজিতে বললে ইংরেজিতে) উত্তর দাও।\n' +
      '২. পূর্ববর্তী আলাপের প্রেক্ষাপট দেওয়া থাকলে তা কাজে লাগিয়ে প্রাসঙ্গিক ও ধারাবাহিক উত্তর দাও।\n' +
      '৩. গুরুত্বপূর্ণ সতর্কতা: যদি কথোপকথনের ভেতরে ব্যবহারকারী নতুন কোনো জটিল শরঈ ফতোয়া বা হালাল-হারাম মাসআলা জানতে চান এবং কথোপকথনে DAWAH X-এর কোনো দলিল না থাকে, তবে নিজ থেকে মনগড়া ফতোয়া দেবে না—বরং সুন্দরভাবে বলবে প্রশ্নটি স্পষ্টভাবে লিখতে যাতে DAWAH X-এর ২৪,২০৭+ ফতোয়া থেকে দলিলসহ খুঁজে দেওয়া যায়।\n' +
      '৪. উত্তরে কাঁচা HTML বা অপ্রয়োজনীয় # হেডিং ব্যবহার করবে না।';

    userContent = inheritedContext
      ? `পূর্ববর্তী উত্তরের DAWAH X সূত্র ও প্রেক্ষাপট:\n${inheritedContext}\n\nব্যবহারকারীর বর্তমান বার্তা:\n${cleanQ}`
      : cleanQ;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  for (const turn of safeHistory.slice(-6)) {
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

        if (buffer.trim().startsWith('data:')) {
          const tail = buffer.trim().slice(5).trim();
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
  const mode = ['grounded', 'chat', 'not_found_islamic'].includes(body?.mode)
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
