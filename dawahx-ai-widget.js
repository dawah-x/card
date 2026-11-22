/*!
 * DAWAH X AI — Standalone Floating Islamic Q&A Widget v1.0
 * Works BOTH:
 *   1) 100% Serverlessly on GitHub Pages (reads DAWAH X's static `search/` shards & `texts/` buckets!)
 *   2) Connected to the Python DAWAH X AI Server (set `window.DAWAHX_AI_API_URL = "https://..."`)
 *
 * Drop into any page of https://ebrahim-ead.github.io/DAWAH-X/:
 *   <script src="dawahx-ai-widget.js" defer></script>
 */
(function () {
  'use strict';
  if (window.__DAWAHX_AI_WIDGET_LOADED__) return;
  window.__DAWAHX_AI_WIDGET_LOADED__ = true;

  const SITE_BASE = (window.DAWAHX_SITE_URL || 'https://ebrahim-ead.github.io/DAWAH-X').replace(/\/+$/, '');
  const API_URL = (window.DAWAHX_AI_API_URL || '').replace(/\/+$/, '');

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const FOLD_MAP = { 'ী': 'ি', 'ূ': 'ু', 'ঈ': 'ই', 'ঊ': 'উ', 'ছ': 'স', 'শ': 'স', 'ষ': 'স', 'য': 'জ', 'ণ': 'ন', 'ৎ': 'ত' };

  function toLatinDigits(s) {
    return String(s || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  }

  // Exact byte-for-byte match with DAWAH X's tools/build-site-data.cjs & app.js
  function foldBn(v) {
    return toLatinDigits(String(v || '').normalize('NFC').toLowerCase())
      .replace(/[\u200b-\u200d\u00ad\ufeff\u0981]/g, '')
      .replace(/([\p{L}\p{M}])[‘’'ʼ](?=\p{L})/gu, '$1')
      .replace(/\u09af\u09bc/g, '\u09df')
      .replace(/\u09a1\u09bc/g, '\u09dc')
      .replace(/\u09a2\u09bc/g, '\u09dd')
      .replace(/([কত])\u09cd\u09ac/g, '$1')
      .replace(/[ীূঈঊছশষযণৎ]/g, (c) => FOLD_MAP[c]);
  }

  function searchTokens(v) {
    return (foldBn(v).match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter((t) => {
      const n = [...t].length;
      return n >= 2 && n <= 30;
    });
  }

  function searchPrefix(t) {
    const a = [...t];
    return a.slice(0, a[1] === '\u09cd' ? 5 : 3).join('');
  }

  function searchShard(t, n) {
    let h = 0x811c9dc5;
    const p = searchPrefix(t);
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % n;
  }

  function decodeIds(b64) {
    const s = atob(b64);
    const out = [];
    let v = 0, sh = 0, prev = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      v |= (c & 127) << sh;
      if (c & 128) sh += 7;
      else {
        prev += v;
        out.push(prev);
        v = 0;
        sh = 0;
      }
    }
    return out;
  }

  const SYNONYMS = [
    ['নামাজ', 'সালাত'],
    ['রোজা', 'সিয়াম', 'সাওম'],
    ['কোরআন', 'কুরআন', 'কোরান', 'কুরান'],
    ['হাদিস', 'সুন্নাহ'],
    ['অজু', 'ওজু', 'উজু'],
    ['দোয়া', 'দোআ', 'দুআ'],
    ['জুমা', 'জুমআ', 'জুমুআ'],
    ['কুরবানি', 'কোরবানি'],
    ['যাকাত', 'জাকাত'],
    ['বিদআত', 'বেদাত'],
    ['রাসুল', 'রসুল', 'নবি'],
    ['রাকাত', 'রাকআত'],
    ['হজ্জ', 'হজ'],
    ['ওমরা', 'উমরা'],
    ['বিয়ে', 'বিবাহ'],
    ['তালাক', 'বিবাহবিচ্ছেদ'],
    ['পর্দা', 'হিজাব', 'নিকাব'],
    ['সুদ', 'রিবা'],
    ['গান', 'বাদ্যযন্ত্র', 'মিউজিক'],
    ['স্রস্টা', 'সৃস্টিকর্তা', 'আল্লাহ'],
  ].map((g) => g.map(foldBn));

  const BANGLISH_MAP = {
    namaz: 'নামাজ সালাত', salat: 'সালাত নামাজ', salah: 'সালাত নামাজ',
    roja: 'রোজা সিয়াম', roza: 'রোজা সিয়াম', fasting: 'রোজা সিয়াম',
    oju: 'ওজু অজু', wudu: 'ওজু অজু', zakat: 'যাকাত নিসাব',
    hajj: 'হজ্জ হজ', qurbani: 'কুরবানি', dua: 'দোয়া দুআ',
    quran: 'কুরআন', hadith: 'হাদিস সুন্নাহ', allah: 'আল্লাহ স্রষ্টা',
    god: 'আল্লাহ স্রষ্টা অস্তিত্ব', atheist: 'নাস্তিক নাস্তিকতা',
    music: 'গান বাদ্যযন্ত্র', riba: 'সুদ ব্যাংক', talaq: 'তালাক বিবাহ',
    hijab: 'পর্দা হিজাব', sahu: 'সাহু সিজদা', injection: 'ইনজেকশন সিয়াম',
  };

  const STOP_WORDS = new Set(
    [
      'কি', 'কী', 'কেন', 'কখন', 'কিভাবে', 'কীভাবে', 'কোন', 'কোনো', 'হয়', 'হবে', 'হলে',
      'করা', 'করে', 'করলে', 'যায়', 'যাবে', 'আছে', 'নেই', 'জন্য', 'থেকে', 'সাথে', 'মধ্যে',
      'ইসলাম', 'ইসলামে', 'ইসলামের', 'প্রশ্ন', 'উত্তর', 'বিধান', 'হুকুম', 'নিয়ম',
    ].map(foldBn)
  );

  function expandQueryTokens(rawQ) {
    let q = rawQ;
    const lat = rawQ.toLowerCase().match(/[a-z]{2,}/g) || [];
    for (const w of lat) {
      if (BANGLISH_MAP[w]) q += ' ' + BANGLISH_MAP[w];
    }
    const base = searchTokens(q).filter((t) => !STOP_WORDS.has(t));
    const use = base.length ? base : searchTokens(q);
    const groups = [];
    for (const tok of use) {
      const alts = new Set([tok]);
      // Strip basic Bengali genitive/locative suffix for root matching
      if (tok.length >= 5 && tok.endsWith('ের')) alts.add(tok.slice(0, -2));
      if (tok.length >= 5 && (tok.endsWith('তে') || tok.endsWith('কে'))) alts.add(tok.slice(0, -2));
      for (const grp of SYNONYMS) {
        for (const m of grp) {
          if (tok.startsWith(m)) {
            const rest = tok.slice(m.length);
            grp.forEach((x) => alts.add(x + rest));
          }
        }
      }
      groups.push([...alts]);
    }
    return groups;
  }

  // Serverless Static Index Engine reading directly from DAWAH X GitHub Pages
  const StaticEngine = {
    meta: null,
    titlesMeta: null,
    keys: '',
    tShards: new Map(),
    bShards: new Map(),
    buckets: new Map(),
    initPromise: null,

    init() {
      if (!this.initPromise) {
        this.initPromise = Promise.all([
          fetch(`${SITE_BASE}/search/meta.json`).then((r) => r.json()),
          fetch(`${SITE_BASE}/search/titles.json`).then((r) => r.json()),
          fetch(`${SITE_BASE}/search/keys.txt`).then((r) => r.text()),
        ]).then(([m, tm, k]) => {
          this.meta = m;
          this.titlesMeta = tm;
          this.keys = k;
          return true;
        });
      }
      return this.initPromise;
    },

    getTShard(i) {
      if (!this.tShards.has(i)) {
        this.tShards.set(
          i,
          fetch(`${SITE_BASE}/search/t${String(i).padStart(2, '0')}.json`).then((r) => r.json())
        );
      }
      return this.tShards.get(i);
    },

    getBShard(i) {
      if (!this.bShards.has(i)) {
        this.bShards.set(
          i,
          fetch(`${SITE_BASE}/search/${String(i).padStart(3, '0')}.json`).then((r) => r.json())
        );
      }
      return this.bShards.get(i);
    },

    getBucket(hex3) {
      if (!this.buckets.has(hex3)) {
        this.buckets.set(
          hex3,
          fetch(`${SITE_BASE}/texts/${hex3}.json`).then((r) => r.json())
        );
      }
      return this.buckets.get(hex3);
    },

    async ask(question) {
      const t0 = performance.now();
      const q = String(question || '').trim();
      // Natural everyday conversation fast-path
      if (/^\s*(?:আসসালামু\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam)(?:\s+ওয়া\s*রাহমাতুল্লাহ)?(?:\s*(?:ভাই|কেমন\s*আছো?|কেমন\s*আছেন|kemon\s*acho))?[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহ! কেমন আছেন আপনি? আমার সাথে স্বাভাবিকভাবে কথা বলতে পারেন অথবা যেকোনো ইসলামিক প্রশ্ন করতে পারেন।' };
      }
      if (/^\s*(?:হ্যালো|হাই|hello|hi+|hey+)(?:\s*(?:কেমন\s*আছো?|there))?[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'হ্যালো! আসসালামু আলাইকুম। কেমন আছেন? আজ কী নিয়ে কথা বলব?' };
      }
      if (/^\s*(?:আপনি\s*|তুমি\s*)?(?:কেমন\s*আছো?|কেমন\s*আছেন|ক[িী]\s*খবর|ক[িী]\s*অবস্থা|kemon\s*acho|kmn\s*acho|how\s*are\s*you)[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'আলহামদুলিল্লাহ, আমি বেশ ভালো আছি! খোঁজ নেওয়ার জন্য ধন্যবাদ। আপনি কেমন আছেন?' };
      }
      if (/^\s*(?:আলহামদুলিল্লাহ\s*)?(?:আমিও?\s*)?(?:ভালো(?:\s*আছি)?|বেশ\s*ভালো|alhamdulillah|bhalo\s*achi|valo\s*achi|i'?m\s*(?:good|fine))[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'আলহামদুলিল্লাহ, শুনে খুব ভালো লাগলো! আল্লাহ আপনাকে সবসময় সুস্থ ও প্রশান্ত রাখুন। বলুন, কী নিয়ে আলাপ করব?' };
      }
      if (/^\s*(?:তুমি\s*)?(?:ক[িী]\s*করছো?|ক[িী]\s*করো?|ভাত\s*(?:খেয়েছো?|খাইছো?)|চা\s*খেয়েছো?|ki\s*korcho|bhat\s*khaicho|what\s*are\s*you\s*doing)[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'এই তো, আপনার সাথেই কথা বলছি! আর DAWAH X-এর দলিলভিত্তিক সংগ্রহ নিয়ে প্রস্তুত আছি। আপনার দিনটা কেমন কাটছে?' };
      }
      if (/^\s*(?:অনেক\s*)?(?:ধন্যবাদ|জাযাকাল্লাহ(?:ু\s*খাইরান)?|শুকরিয়া|মাশাআল্লাহ|আচ্ছা|বুঝলাম|ওকে|thanks?|thank\s*you|jazakallah|ok+|okay)[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'ওয়া ইয়্যাকুম—আল্লাহ আপনাকেও উত্তম প্রতিদান দিন! আরও কোনো কথা বা প্রশ্ন থাকলে নির্দ্বিধায় বলুন।' };
      }
      if (/^\s*(?:আল্লাহ\s*হাফেজ|ফি\s*আমানিল্লাহ|বিদায়|ভালো\s*থেকো|allah\s*hafez|bye+)[।!?.,\s]*$/i.test(q)) {
        return { is_chat: true, direct_answer: 'আল্লাহ হাফেজ! ফি আমানিল্লাহ—আল্লাহ আপনাকে নিরাপদে রাখুন। আবার কথা হবে!' };
      }

      await this.init();
      const groups = expandQueryTokens(question);
      if (!groups.length) return { status: 'not_found', is_chat: true, sources: [] };

      const N = this.meta.n;
      const docScores = new Map();
      const groupHits = new Map();

      // 1) Score Title Shards (high weight) + Body Shards
      for (let gi = 0; gi < groups.length; gi++) {
        const alts = groups[gi];
        const matchedTitleDocs = new Set();
        const matchedBodyDocs = new Set();

        for (const term of alts) {
          if ([...term].length < 2) continue;
          const tIdx = searchShard(term, this.titlesMeta.shards);
          const tData = await this.getTShard(tIdx);
          for (const k in tData) {
            if (k.startsWith(term) || term.startsWith(k)) {
              decodeIds(tData[k]).forEach((id) => matchedTitleDocs.add(id));
            }
          }

          if ([...term].length >= 3) {
            const bIdx = searchShard(term, this.meta.shards);
            const bData = await this.getBShard(bIdx);
            for (const k in bData) {
              if (k === term || k.startsWith(term)) {
                decodeIds(bData[k]).forEach((id) => matchedBodyDocs.add(id));
              }
            }
          }
        }

        const idfTitle = Math.log(1 + N / Math.max(matchedTitleDocs.size, 1));
        const idfBody = Math.log(1 + N / Math.max(matchedBodyDocs.size, 1));

        for (const id of matchedTitleDocs) {
          docScores.set(id, (docScores.get(id) || 0) + idfTitle * 3.2);
          groupHits.set(id, (groupHits.get(id) || 0) + 1);
        }
        for (const id of matchedBodyDocs) {
          docScores.set(id, (docScores.get(id) || 0) + idfBody * 0.9);
          if (!matchedTitleDocs.has(id)) {
            groupHits.set(id, (groupHits.get(id) || 0) + 0.65);
          }
        }
      }

      const ranked = [...docScores.entries()]
        .map(([id, sc]) => {
          const cov = (groupHits.get(id) || 0) / groups.length;
          return [id, sc * (0.35 + 0.65 * cov), cov];
        })
        .filter((x) => x[2] >= 0.34)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (!ranked.length) {
        return {
          status: 'not_found',
          headline: 'সরাসরি উত্তর পাওয়া যায়নি',
          direct_answer:
            'দুঃখিত, আপনার এই নির্দিষ্ট প্রশ্নটির সরাসরি উত্তর DAWAH X সংগ্রহে পাওয়া যায়নি। নিচে ক্লিক করে সরাসরি DAWAH X টিমে প্রশ্ন পাঠাতে পারেন।',
          sources: [],
          latency_ms: Math.round(performance.now() - t0),
        };
      }

      const keys = ranked.map(([id]) => this.keys.slice(id * 14, id * 14 + 14));
      const fetchedDocs = await Promise.all(
        keys.map(async (k, idx) => {
          const b = await this.getBucket(k.slice(-3));
          return { key: k, raw: b[k], rank: idx + 1 };
        })
      );

      const validDocs = fetchedDocs.filter((d) => d.raw);
      const top = validDocs[0].raw;
      const plain = String(top.h || '')
        .replace(/<(?:h[1-4]|b|strong)[^>]*>\s*(?:অফিসিয়াল\s+)?(?:উত্তর|জবাব)\s*[:ঃ]?\s*<\/(?:h[1-4]|b|strong)>/i, '\n__ANS__\n')
        .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/[ \t]+/g, ' ');
      const afterAns = plain.includes('__ANS__') ? plain.split('__ANS__')[1] : plain;
      const paras = afterAns
        .split(/\n+/)
        .map((s) => s.replace(/^\s*(?:উত্তর|জবাব)\s*[:ঃ\-]?\s*/, '').trim())
        .filter((s) => s.length >= 20);

      return {
        status: 'answered',
        headline: String(top.t || '').replace(/^\s*প্রশ্ন\s*(?:\([^)]+\))?\s*[:ঃ]\s*/, ''),
        primary_source_name: top.c || top.s,
        direct_answer: paras.slice(0, 2).join('\n\n').slice(0, 900),
        sources: validDocs.slice(0, 4).map((d) => ({
          rank: d.rank,
          key: d.key,
          title: d.raw.t,
          source_name: d.raw.c || d.raw.s,
          dawahx_url: `${SITE_BASE}/read.html?k=${d.key}`,
        })),
        latency_ms: Math.round(performance.now() - t0),
      };
    },
  };

  // Build Shadow DOM Widget UI
  const host = document.createElement('div');
  host.id = 'dawahx-ai-widget-root';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: "Hind Siliguri", system-ui, sans-serif; }
      .fab {
        position: fixed; right: 20px; bottom: 20px; z-index: 99998;
        display: flex; align-items: center; gap: 9px;
        padding: 12px 18px; border-radius: 999px;
        border: 1.5px solid #f5b81c;
        background: linear-gradient(135deg, #ffd651, #f5a800);
        color: #1a1300; font-weight: 700; font-size: 15px;
        cursor: pointer; box-shadow: 0 10px 28px rgba(245, 168, 0, 0.4);
      }
      .panel {
        position: fixed; right: 20px; bottom: 78px; z-index: 99999;
        width: min(410px, calc(100vw - 28px)); height: min(580px, calc(100vh - 110px));
        background: #06121b; color: #eef2f8;
        border: 1px solid #1f4363; border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.65);
        display: none; flex-direction: column; overflow: hidden;
      }
      .panel.open { display: flex; }
      .hdr {
        padding: 13px 16px; background: #091a28; border-bottom: 1px solid #1f4363;
        display: flex; align-items: center; justify-content: space-between;
      }
      .hdr b { color: #ffd56a; font-size: 15.5px; }
      .hdr small { display: block; font-size: 11.5px; color: #93a4bc; }
      .xbtn { background: transparent; border: 1px solid #1f4363; color: #eef2f8; border-radius: 7px; padding: 4px 9px; cursor: pointer; }
      .msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 14.5px; line-height: 1.62; }
      .u-msg { align-self: flex-end; background: #123149; border: 1px solid #24527a; padding: 9px 13px; border-radius: 13px 13px 3px 13px; max-width: 85%; }
      .a-msg { background: #0a1b28; border: 1px solid #1f4363; padding: 12px 14px; border-radius: 13px; display: flex; flex-direction: column; gap: 8px; }
      .a-msg h4 { margin: 0; color: #ffd56a; font-size: 15px; }
      .verdict { border-left: 3px solid #f5b81c; padding-left: 10px; white-space: pre-line; }
      .src-link { display: block; font-size: 12.5px; color: #ffd56a; background: rgba(245,184,28,0.1); border: 1px solid rgba(245,184,28,0.3); padding: 6px 9px; border-radius: 8px; text-decoration: none; margin-top: 4px; }
      .inp-bar { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #1f4363; background: #040c10; }
      .inp-bar input { flex: 1; background: #091824; border: 1px solid #1f4363; border-radius: 9px; padding: 9px 12px; color: #eef2f8; font: inherit; font-size: 14px; outline: none; }
      .inp-bar button { background: #f5b81c; color: #1a1300; border: 0; border-radius: 9px; padding: 0 14px; font: inherit; font-weight: 700; cursor: pointer; }
    </style>
    <button class="fab" id="fabBtn">✦ DAWAH X AI</button>
    <div class="panel" id="chatPanel">
      <div class="hdr">
        <div>
          <b>DAWAH X AI সহকারী</b>
          <small>স্বাভাবিক কথোপকথন ও DAWAH X দলিলভিত্তিক উত্তর</small>
        </div>
        <button class="xbtn" id="closeBtn">✕</button>
      </div>
      <div class="msgs" id="msgsBox">
        <div class="a-msg">
          <h4>আসসালামু আলাইকুম! 😊</h4>
          <div>আমার সাথে স্বাভাবিকভাবে কথা বলুন অথবা যেকোনো ইসলামিক প্রশ্ন লিখুন — DAWAH X-এর ২৪,২০৭+ ফতোয়া ও প্রবন্ধ থেকে দলিলসহ উত্তর দেব।</div>
        </div>
      </div>
      <form class="inp-bar" id="wForm">
        <input type="text" id="wInput" placeholder="কথা বলুন বা প্রশ্ন লিখুন..." required />
        <button type="submit">পাঠান</button>
      </form>
    </div>
  `;

  const fabBtn = shadow.getElementById('fabBtn');
  const closeBtn = shadow.getElementById('closeBtn');
  const panel = shadow.getElementById('chatPanel');
  const msgsBox = shadow.getElementById('msgsBox');
  const wForm = shadow.getElementById('wForm');
  const wInput = shadow.getElementById('wInput');

  fabBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) wInput.focus();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  wForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = wInput.value.trim();
    if (!q) return;
    wInput.value = '';

    const u = document.createElement('div');
    u.className = 'u-msg';
    u.textContent = q;
    msgsBox.appendChild(u);

    const a = document.createElement('div');
    a.className = 'a-msg';
    a.textContent = 'DAWAH X থেকে দলিল খোঁজা হচ্ছে...';
    msgsBox.appendChild(a);
    msgsBox.scrollTop = msgsBox.scrollHeight;

    let widgetHistory = window.__dawahxWidgetHistory || (window.__dawahxWidgetHistory = []);
    try {
      let resData;
      if (API_URL) {
        const r = await fetch(`${API_URL}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, top_k: 4, history: widgetHistory.slice(-8) }),
        });
        resData = await r.json();
      } else if (window.DawahXBrowserAI) {
        resData = await window.DawahXBrowserAI.ask(q, 'all', 4, widgetHistory.slice(-8));
      } else {
        resData = await StaticEngine.ask(q);
      }

      widgetHistory.push({ role: 'user', text: q });
      widgetHistory.push({
        role: 'assistant',
        text: resData.direct_answer || '',
        primary_title: resData.headline || '',
        extra_body: resData.extra_body || '',
        evidences: resData.evidences || [],
        sources: resData.sources || [],
        videos: resData.videos || [],
      });

      const links = (resData.sources || [])
        .slice(0, 3)
        .map((s) => `<a class="src-link" href="${esc(s.dawahx_url)}" target="_blank" rel="noopener">📄 ${esc(s.title)} ↗</a>`)
        .join('');

      if (resData.is_chat || resData.status === 'conversational') {
        a.innerHTML = `<div>${esc(resData.direct_answer || '')}</div>${links}`;
      } else {
        a.innerHTML = `
          <h4>${esc(resData.headline || 'উত্তর')}</h4>
          <div class="verdict">${esc(resData.direct_answer || '')}</div>
          ${links || `<a class="src-link" href="${SITE_BASE}/ask.html" target="_blank">✉ DAWAH X টিমে প্রশ্ন পাঠান ↗</a>`}
        `;
      }
      msgsBox.scrollTop = msgsBox.scrollHeight;
    } catch (_) {
      a.textContent = 'দুঃখিত, সংযোগে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
    }
  });
})();
