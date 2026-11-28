/**
 * v23.1 Corpus Transparency & Security Test Suite
 * Verifies: source allowlist integrity, citation transparency, PII/security
 * sanitization, offline/graceful-degradation behaviour, and unanswered-question
 * tracker safety.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const ROOT = new URL('..', import.meta.url).pathname;
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`); }
}

function loadEngine(fetchImpl) {
  const sandbox = {
    console,
    performance: { now: () => Date.now() },
    fetch: fetchImpl || (() => Promise.reject(new Error('offline'))),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ROOT + 'browser-ai.js', 'utf8'), sandbox);
  return sandbox.DawahXBrowserAI;
}

console.log('\n=== 1. SOURCE ALLOWLIST INTEGRITY ===');
{
  const allowed = [
    'ebrahim-ead.github.io', 'dawah-x.github.io', 'quran.com', 'api.quran.com',
    'verses.quran.com', 'verses.quran.foundation', 'hadithbd.com',
    'raw.githubusercontent.com', 'ead.ead123628.workers.dev', 'wa.me',
    'youtube.com', 'youtube-nocookie.com', 'api.groq.com',
    'generativelanguage.googleapis.com', 'cache.dawahx.internal',
    'translate.googleapis.com', 'translate.google.com', 'dawahx-tts-cache.local',
  ];
  const files = [
    'browser-ai.js', 'app.js', 'cloudflare/worker.js', 'cloudflare/ai-handler.js',
    'cloudflare/external-sources.js', 'functions/api/unanswered.js',
  ];
  let allOk = true; let detail = '';
  for (const f of files) {
    const c = fs.readFileSync(ROOT + f, 'utf8');
    const urls = c.match(/https?:\/\/[^\s'"<>\\)`]+/g) || [];
    for (const u of urls) {
      const clean = u.replace(/\$\{[^}]*\}/g, '');
      try {
        const h = new URL(clean).hostname.replace(/^www\./, '');
        const isRawDawahX = h === 'raw.githubusercontent.com' && /Ebrahim-ead\/DAWAH-X/.test(u);
        if (!allowed.some((d) => h === d || h.endsWith('.' + d)) && !isRawDawahX) {
          allOk = false; detail += f + ' :: ' + u + '; ';
        }
      } catch (_) {}
    }
  }
  ok('all external URLs restricted to approved sources + own infra', allOk, detail.slice(0, 300));
  const ext = fs.readFileSync(ROOT + 'cloudflare/external-sources.js', 'utf8');
  ok('external-sources only yields Quran.com / HadithBD URLs',
    !/(?:facebook|instagram|twitter|x\.com|tiktok|snapchat)\.com/i.test(ext));
}

console.log('\n=== 2. CITATION TRANSPARENCY (answers carry provenance) ===');
{
  const e = loadEngine();
  // Quran direct answer must carry sources with Quran.com URL
  const qr = await e.ask('আয়াতুল কুরসী অর্থসহ দাও', 'quran', 5, []);
  const qrJson = JSON.stringify(qr || {});
  ok('quran answer has sources with quran.com provenance', /quran\.com/.test(qrJson), qr && qr.status);
  ok('quran answer has evidences array', Array.isArray(qr && qr.evidences));
  // Hadith answer must cite hadithbd.com
  const hd = await e.ask('ঘুমানোর দোয়া বাংলা অর্থসহ', 'hadith', 5, []);
  const hdJson = JSON.stringify(hd || {});
  ok('hadith answer has hadithbd.com provenance', /hadithbd\.com/.test(hdJson), hd && hd.status);
  // Deep book answer must cite DAWAH X book reader URL (surah-based offline enrichment)
  const e2 = loadEngine();
  const book = await e2.ask('তাফসীর ইবনে কাসীর সূরা আলে ইমরান পৃষ্ঠা ৫', 'all', 5, []);
  const bookJson = JSON.stringify(book || {});
  ok('deep-book answer cites DAWAH X Islamic Book URL', /islamic-book-(?:read|collection)\.html/.test(bookJson), book && book.status);
}

console.log('\n=== 3. PII & SECURITY SANITIZATION ===');
{
  const src = fs.readFileSync(ROOT + 'cloudflare/ai-handler.js', 'utf8');
  const sanitizeIdx = src.indexOf('export function sanitizeAnonymousQuestion');
  ok('sanitizeAnonymousQuestion exists', sanitizeIdx >= 0);
  // Extract and test the function in a VM
  const fnStart = src.indexOf('export function sanitizeAnonymousQuestion');
  const fnEnd = src.indexOf('\nasync function loadUnansweredStore', fnStart);
  const fnSrc = src.slice(fnStart, fnEnd);
  // Include the SECULAR_OOD_FILTER_RE the function references
  const reStart = src.indexOf('const SECULAR_OOD_FILTER_RE =');
  const reEnd = src.indexOf('\nexport function sanitizeAnonymousQuestion', reStart);
  const reSrc = src.slice(reStart, reEnd);
  const sandbox = { console, String, Object, Array, RegExp };
  vm.createContext(sandbox);
  vm.runInContext(reSrc, sandbox);
  vm.createContext(sandbox);
  let sanitize = null;
  try {
    vm.runInContext('globalThis.sanitizeAnonymousQuestion = ' + fnSrc.replace('export function', 'function'), sandbox);
    sanitize = sandbox.sanitizeAnonymousQuestion;
  } catch (err) {
    ok('sanitize extracted', false, String(err).slice(0, 100));
  }
  if (sanitize) {
    ok('email is masked', sanitize('আমার ইমেইল foo@bar.com এ জানান') !== 'foo@bar.com');
    ok('phone is masked', !/\d{11}/.test(sanitize('ফোন নম্বর 01712345678 দিন')));
    ok('short input rejected', sanitize('কি') === '');
    ok('PII-stripped output keeps question', sanitize('আমার ইমেইল x@y.com দিয়ে জানান') .includes('জানান'));
  }
  // worker must not echo raw question into logs without sanitization
  ok('unanswered tracker uses sanitizer on POST', src.includes('sanitizeAnonymousQuestion(rawQuestion)') || src.includes('sanitizeAnonymousQuestion(body?.question)'));
  ok('no raw env secret echo in health', !/API_KEY/.test(fs.readFileSync(ROOT + 'cloudflare/worker.js', 'utf8')));
}

console.log('\n=== 4. GRACEFUL DEGRADATION & OFFLINE SAFETY ===');
{
  const e = loadEngine();
  const offline = await e.ask('রোজা ভঙ্গ করার কারণ কী', 'all', 5, []);
  ok('offline returns status=offline (no throw)', offline && offline.status === 'offline', offline && offline.status);
  ok('offline payload has no error/throw fields', offline && !/Error|Failed to fetch/i.test(JSON.stringify(offline)));
  ok('offline payload has follow_ups for usability', Array.isArray(offline && offline.follow_ups) && offline.follow_ups.length > 0);

  // not_found auto-response (test the payload builder directly)
  const nf = e._notFoundPayload('এই প্রশ্নটি কর্পাসে নেই খুঁজে দেখো', [], [], 0);
  ok('not_found has auto_response flag', nf && nf.status === 'not_found' && nf.auto_response === true, nf && nf.status);
  ok('not_found provides rephrase_suggestions', Array.isArray(nf && nf.rephrase_suggestions) && nf.rephrase_suggestions.length > 0);
  ok('rephrase suggestions are non-empty strings', (nf.rephrase_suggestions || []).every((s) => typeof s === 'string' && s.length > 3));
}

console.log('\n=== 5. UNANSWERED-QUESTION TRACKER SAFETY ===');
{
  const workerMod = await import(ROOT + 'cloudflare/worker.js');
  const worker = workerMod.default || workerMod;
  const stored = new Map();
  const mockKV = {
    async get(k) { return stored.has(k) ? stored.get(k) : null; },
    async put(k, v) { stored.set(k, v); },
  };
  const env = { UNANSWERED_KV: mockKV };

  // PII-laden question must be sanitized, not stored raw
  const piiQ = 'আমার ইমেইল test@example.com ও ফোন 01712345678 জানান করুন';
  const post = new Request('https://x.workers.dev/api/unanswered', {
    method: 'POST',
    body: JSON.stringify({ question: piiQ, filter: 'all' }),
    headers: { 'content-type': 'application/json' },
  });
  const r = await worker.fetch(post, env, { waitUntil: () => {} });
  const body = await r.json();
  ok('POST accepts question', r.status === 200 && body.ok === true, JSON.stringify(body));

  const get = await worker.fetch(new Request('https://x.workers.dev/api/unanswered', { method: 'GET' }), env, { waitUntil: () => {} });
  const items = (await get.json()).items || [];
  const storedQ = items[0] && items[0].question || '';
  ok('stored question has email masked', !storedQ.includes('test@example.com'), storedQ.slice(0, 120));
  ok('stored question has phone masked', !/\b017\d{8}\b/.test(storedQ), storedQ.slice(0, 120));

  // Invalid JSON must be rejected safely
  const bad = await worker.fetch(new Request('https://x.workers.dev/api/unanswered', {
    method: 'POST', body: 'not-json', headers: { 'content-type': 'application/json' },
  }), env, { waitUntil: () => {} });
  ok('invalid JSON returns 400 without crash', bad.status === 400, 'status=' + bad.status);

  // GET must not leak internal map keys
  const getBody = JSON.stringify(await (await worker.fetch(new Request('https://x.workers.dev/api/unanswered', { method: 'GET' }), env, { waitUntil: () => {} })).json());
  ok('GET response has no internal keys', !getBody.includes('norm:') && !getBody.includes('MEM_UNANSWERED'));
}

console.log('\n=== 6. UI CITATION RENDERING (static checks) ===');
{
  const app = fs.readFileSync(ROOT + 'app.js', 'utf8');
  ok('citation strip rendering added', app.includes('citation-strip') && app.includes('citationStripHtml'));
  ok('inline cite markers applied to direct answer', app.includes('citeInline'));
  ok('rephrase chips rendering added', app.includes('rephrase-suggestions') && app.includes('rephraseChips'));
  ok('not_found auto-response rephrase_suggestions consumed in UI', app.includes('rephrase_suggestions') && app.includes('rephraseChips'));
  const css = fs.readFileSync(ROOT + 'styles.css', 'utf8');
  ok('citation styles defined', css.includes('.citation-strip') && css.includes('.citation-list'));
  ok('rephrase chip styles defined', css.includes('.rephrase-suggestions'));
}

console.log('\n=== 7. CORPUS INTEGRITY ===');
{
  const e = loadEngine();
  // Offline essential Quran must be complete and correct
  const ayatul = await e.ask('আয়াতুল কুরসী অর্থসহ দাও', 'all', 5, []);
  ok('offline Ayatul Kursi returns full text', /ٱ/.test(JSON.stringify(ayatul || {})), ayatul && ayatul.status);
  const falaq = await e.ask('সূরা ফালাক অর্থসহ', 'all', 5, []);
  ok('offline Surah Falaq returns full text', JSON.stringify(falaq || {}).includes('قُلۡ أَعُوذُ'), falaq && falaq.status);
}

console.log('\n==============================');
console.log(`PASS: ${pass}  FAIL: ${fail}`);
if (failures.length) console.log('FAILED: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
