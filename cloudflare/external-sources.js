/**
 * DAWAH X AI — Strictly Allowlisted Verified External Islamic Sources (v19.0)
 *
 * ONLY permits outbound retrieval from the user's explicitly approved official Islamic sources:
 *   1. Quran.com (`https://quran.com/` via official keyless API `https://api.quran.com/api/v4`)
 *   2. HadithBD / বাংলা হাদিস (`https://www.hadithbd.com/`)
 *
 * NEVER fetches, parses, or cites any other external website on the internet.
 */

export const ALLOWED_SOURCE_HOSTS = new Set([
  'api.quran.com',
  'quran.com',
  'www.quran.com',
  'www.hadithbd.com',
  'hadithbd.com',
  'ebrahim-ead.github.io',
]);

export function isAllowedSourceUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''));
    return u.protocol === 'https:' && ALLOWED_SOURCE_HOSTS.has(u.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

const BN_TO_EN_DIGIT = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const EN_TO_BN_DIGIT = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toAsciiDigits(str) {
  return String(str || '').replace(/[০-৯]/g, (d) => BN_TO_EN_DIGIT[d] ?? d);
}

export function toBengaliDigits(str) {
  return String(str || '').replace(/[0-9]/g, (d) => EN_TO_BN_DIGIT[Number(d)] ?? d);
}

// 114 Surahs: Bengali display names + search aliases
const SURAH_CATALOG = [
  [1, 'আল-ফাতিহা', ['ফাতিহা', 'ফাতেহা', 'fatiha', 'fatihah']],
  [2, 'আল-বাকারা', ['বাকারা', 'বাকারাহ', 'baqara', 'baqarah']],
  [3, 'আল-ইমরান', ['ইমরান', 'আলে ইমরান', 'imran']],
  [4, 'আন-নিসা', ['নিসা', 'নেসা', 'nisa']],
  [5, 'আল-মায়িদাহ', ['মায়িদা', 'মায়েদা', 'মায়িদাহ', 'maidah']],
  [6, 'আল-আনআম', ['আনআম', 'আনয়াম', 'anam']],
  [7, 'আল-আরাফ', ['আরাফ', 'araf']],
  [8, 'আল-আনফাল', ['আনফাল', 'anfal']],
  [9, 'আত-তাওবাহ', ['তাওবা', 'তাওবাহ', 'সুরা তওবা', 'tawbah', 'taubah']],
  [10, 'ইউনুস', ['ইউনুস', 'yunus']],
  [11, 'হূদ', ['হুদ', 'হূদ', 'hud']],
  [12, 'ইউসুফ', ['ইউসুফ', 'yusuf']],
  [13, 'আর-রাদ', ['রাদ', 'রা’দ', 'rad']],
  [14, 'ইবরাহীম', ['ইবরাহিম', 'ইবরাহীম', 'ibrahim']],
  [15, 'আল-হিজর', ['হিজর', 'hijr']],
  [16, 'আন-নাহল', ['নাহল', 'nahl']],
  [17, 'বনী ইসরাঈল (আল-ইসরা)', ['ইসরা', 'বনী ইসরাঈল', 'বনি ইসরাইল', 'isra']],
  [18, 'আল-কাহফ', ['কাহফ', 'কাহাফ', 'kahf']],
  [19, 'মারইয়াম', ['মারইয়াম', 'মরিয়ম', 'maryam']],
  [20, 'ত্বা-হা', ['ত্বাহা', 'তাহা', 'taha']],
  [21, 'আল-আম্বিয়া', ['আম্বিয়া', 'ambiya', 'anbiya']],
  [22, 'আল-হাজ্জ', ['হাজ্জ', 'হজ্জ', 'hajj']],
  [23, 'আল-মুমিনূন', ['মুমিনুন', 'মুমিনূন', 'muminun']],
  [24, 'আন-নূর', ['নূর', 'নুর', 'nur', 'noor']],
  [25, 'আল-ফুরকান', ['ফুরকান', 'furqan']],
  [31, 'লুকমান', ['লুকমান', 'luqman']],
  [32, 'আস-সাজদাহ', ['সাজদা', 'সাজদাহ', 'sajdah']],
  [33, 'আল-আহযাব', ['আহযাব', 'আহজাব', 'ahzab']],
  [36, 'ইয়াসীন', ['ইয়াসিন', 'ইয়াসীন', 'ইয়াসিন', 'yasin', 'yaseen']],
  [39, 'আয-যুমার', ['যুমার', 'জুমার', 'zumar']],
  [47, 'মুহাম্মাদ', ['সুরা মুহাম্মদ', 'সূরা মুহাম্মাদ', 'surah muhammad']],
  [48, 'আল-ফাতহ', ['ফাতহ', 'ফাতাহ', 'fath']],
  [49, 'আল-হুজুরাত', ['হুজুরাত', 'hujurat']],
  [55, 'আর-রহমান', ['আর রহমান', 'আর-রহমান', 'রহমান', 'rahman']],
  [56, 'আল-ওয়াকিয়াহ', ['ওয়াকিয়া', 'ওয়াকিয়াহ', 'waqiah']],
  [59, 'আল-হাশর', ['হাশর', 'hashr']],
  [62, 'আল-জুমুআহ', ['জুমুআ', 'জুমুআহ', 'জুম্মা', 'jumuah']],
  [65, 'আত-তালাক', ['সূরা তালাক', 'সুরা তালাক', 'surah talaq']],
  [67, 'আল-মুলক', ['মুলক', 'সুরা মুলক', 'সূরা মুলক', 'mulk']],
  [73, 'আল-মুযযাম্মিল', ['মুযযাম্মিল', 'মুজ্জাম্মিল', 'muzzammil']],
  [78, 'আন-নাবা', ['নাবা', 'আম্মা', 'naba']],
  [87, 'আল-আলা', ['আলা', 'সূরা আলা', 'ala']],
  [93, 'আদ-দুহা', ['দুহা', 'দোহা', 'duha']],
  [94, 'আল-ইনশিরাহ', ['ইনশিরাহ', 'আলাম নাশরাহ', 'শারহ', 'inshirah']],
  [95, 'আত-তীন', ['তীন', 'তিন', 'tin']],
  [96, 'আল-আলাক', ['আলাক', 'ইকরা', 'alaq']],
  [97, 'আল-কদর', ['কদর', 'ক্বদর', 'qadr']],
  [99, 'আয-যিলযাল', ['যিলযাল', 'জিলজাল', 'zilzal']],
  [102, 'আত-তাকাসুর', ['তাকাসুর', 'takathur']],
  [103, 'আল-আসর', ['সূরা আসর', 'সুরা আসর', 'আল আসর', 'surah asr']],
  [105, 'আল-ফীল', ['ফীল', 'ফিল', 'fil']],
  [106, 'কুরাইশ', ['কুরাইশ', 'quraish']],
  [107, 'আল-মাউন', ['মাউন', 'মাঊন', 'maun']],
  [108, 'আল-কাউসার', ['কাউসার', 'কাওসার', 'kawthar', 'kausar']],
  [109, 'আল-কাফিরূন', ['কাফিরুন', 'কাফিরূন', 'kafirun']],
  [110, 'আন-নাসর', ['নাসর', 'nasr']],
  [111, 'আল-লাহাব', ['লাহাব', 'মাসাদ', 'lahab', 'masad']],
  [112, 'আল-ইখলাস', ['ইখলাস', 'এখলাস', 'ikhlas']],
  [113, 'আল-ফালাক', ['ফালাক', 'ফালাক্ব', 'falaq']],
  [114, 'আন-নাস', ['সূরা নাস', 'সুরা নাস', 'আন নাস', 'আন-নাস', 'surah nas']],
];

const SURAH_NAME_BY_NUM = new Map(SURAH_CATALOG.map(([num, name]) => [num, name]));

async function safeAllowedFetch(url, options = {}, timeoutMs = 2600, fetchImpl = fetch) {
  if (!isAllowedSourceUrl(url)) {
    throw new Error(`Blocked non-allowlisted host: ${url}`);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'bn,en;q=0.8,ar;q=0.7',
        'User-Agent': 'DAWAH-X-AI/19.0 (+https://ebrahim-ead.github.io/DAWAH-X/)',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function decodeHtmlEntities(raw) {
  return String(raw || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, '’')
    .replace(/&ndash;|&mdash;/gi, '—')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch (_) {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch (_) {
        return '';
      }
    });
}

export function stripHtmlTags(raw, preserveNewlines = false) {
  let s = String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '');
  if (preserveNewlines) {
    s = s.replace(/<\/?(?:p|div|br|li|tr|h[1-6]|section|article|blockquote)[^>]*>/gi, '\n');
  }
  s = decodeHtmlEntities(s.replace(/<[^>]+>/g, ' '));
  return preserveNewlines
    ? s
        .split('\n')
        .map((ln) => ln.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    : s.replace(/\s+/g, ' ').trim();
}

const STOP_WORDS = new Set([
  'কেউ',
  'যদি',
  'তাহলে',
  'আমাকে',
  'আমাদের',
  'বলুন',
  'বলেন',
  'বলবেন',
  'জানতে',
  'চাই',
  'কীভাবে',
  'কিভাবে',
  'কেমন',
  'দেওয়ার',
  'দেয়ার',
  'করার',
  'নিয়ম',
  'সঠিক',
  'বিধান',
  'সম্পর্কে',
  'বিষয়ে',
  'কী',
  'কি',
  'কেন',
  'কখন',
  'কোথায়',
  'কোন',
  'একটু',
  'দয়া',
  'করে',
  'বিস্তারিত',
  'সংক্ষেপে',
  'দলিলসহ',
  'দলিল',
  'আলোচনা',
  'করুন',
  'হয়',
  'হবে',
  'যাবে',
  'যায়',
  'করা',
  'দেওয়া',
  'পড়া',
  'আছে',
  'নাকি',
  'অথবা',
  'এবং',
  'ও',
  'বা',
  'এর',
  'এই',
  'সেই',
  'কোনো',
  'কোনটি',
  'কত',
  'থেকে',
  'মধ্যে',
  'ভেতরে',
  'উপর',
  'নিচে',
  'আগে',
  'আগের',
  'পরে',
  'পরের',
  'সময়',
  'ইসলামে',
  'ইসলামের',
  'শরীয়তে',
  'কুরআন',
  'কুরআনে',
  'কোরআন',
  'হাদীস',
  'হাদীসে',
  'হাদিস',
  'হাদিসে',
  'আয়াত',
  'আলোকে',
  'অর্থ',
  'ব্যাখ্যা',
  'সহ',
  'what',
  'how',
  'is',
  'the',
  'in',
  'of',
  'to',
  'about',
  'ruling',
  'islam',
]);

export function extractCoreSearchQueries(question) {
  const cleaned = String(question || '')
    .normalize('NFC')
    .replace(/[?!।,.;:'"“”‘’()[\]{}\/\\|+*=~`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { hadithQuery: '', quranQuery: '' };

  // Preserve direct Hadith reference like "বুখারী ১২২৪" or "মুসলিম ৫৭০"
  const directHadithRef = toAsciiDigits(cleaned).match(
    /(বুখারী|বুখারি|মুসলিম|তিরমিযী|তিরমিজি|আবূ দাউদ|আবু দাউদ|নাসায়ী|নাসাঈ|ইবনু মাজাহ|ইবনে মাজাহ|মিশকাত|রিয়াদুস সালেহীন|bukhari|muslim|tirmidhi|abu dawud)\s*(?:হাদীস|হাদিস|নং|নম্বর|হা\/|:|-)?\s*(\d{1,5})/iu
  );
  if (directHadithRef) {
    const refQ = `${directHadithRef[1]} ${directHadithRef[2]}`;
    return { hadithQuery: refQ, quranQuery: refQ };
  }

  const tokens = cleaned
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()));

  const coreTokens = (tokens.length > 0 ? tokens : cleaned.split(' ')).slice(0, 5);
  const hadithQuery = coreTokens.join(' ').trim();

  // Map colloquial Bengali terms to classical Quran translation terminology for api.quran.com
  const quranTokens = coreTokens.map((w) => {
    if (/^নামা[জয]/u.test(w)) return 'সালাত';
    if (/^রো[জয]া/u.test(w)) return 'সাওম';
    if (/^সুদ/u.test(w)) return 'রিবা';
    if (/^মিরাস/u.test(w)) return 'উত্তরাধিকার';
    if (/^যিনা|^জিনা/u.test(w)) return 'ব্যভিচার';
    return w;
  });

  return {
    hadithQuery,
    quranQuery: quranTokens.slice(0, 4).join(' ').trim(),
  };
}

export function detectDirectQuranReferences(question) {
  const asciiQ = toAsciiDigits(String(question || '').normalize('NFC'));
  const lowerQ = asciiQ.toLowerCase();
  const refs = [];

  // 1. Famous named passages
  if (/আয়াতুল\s*কুরস[ীি]|আয়াতুল\s*কুরছ[ীি]|ayatul\s*kursi/iu.test(asciiQ)) {
    refs.push({ type: 'verse', key: '2:255' });
  }
  if (/বাকারার?\s*শেষ\s*(?:দুই|২|দুটি)\s*আয়াত/iu.test(asciiQ)) {
    refs.push({ type: 'verse', key: '2:285' });
    refs.push({ type: 'verse', key: '2:286' });
  }

  // 2. Explicit chapter:verse (e.g. 2:255 or 2:285-286)
  const colonMatches = asciiQ.matchAll(/(?:^|[^\d])(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?=$|[^\d])/g);
  for (const m of colonMatches) {
    const ch = Number(m[1]);
    const vStart = Number(m[2]);
    const vEnd = m[3] ? Math.min(Number(m[3]), vStart + 3) : vStart;
    if (ch >= 1 && ch <= 114 && vStart >= 1 && vStart <= 286) {
      for (let v = vStart; v <= vEnd; v++) {
        refs.push({ type: 'verse', key: `${ch}:${v}` });
      }
    }
  }

  // 3. Named Surah + optional verse number
  for (const [surahNum, , aliases] of SURAH_CATALOG) {
    for (const alias of aliases) {
      if (lowerQ.includes(alias.toLowerCase())) {
        // Check if an ayah number appears near the surah name
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ayahMatch = asciiQ.match(
          new RegExp(`${escaped}[^\\d]{0,28}(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`, 'iu')
        );
        if (ayahMatch) {
          const vStart = Number(ayahMatch[1]);
          const vEnd = ayahMatch[2] ? Math.min(Number(ayahMatch[2]), vStart + 3) : vStart;
          if (vStart >= 1 && vStart <= 286) {
            for (let v = vStart; v <= vEnd; v++) {
              refs.push({ type: 'verse', key: `${surahNum}:${v}` });
            }
          }
        } else if (surahNum === 1 || surahNum >= 93) {
          // Short Surahs (Al-Fatiha & Ad-Duha..An-Nas): fetch opening/complete verses directly
          refs.push({ type: 'chapter', chapter: surahNum });
        }
        break;
      }
    }
  }

  // Deduplicate
  const uniq = [];
  const seen = new Set();
  for (const r of refs) {
    const id = r.type === 'verse' ? `v:${r.key}` : `c:${r.chapter}`;
    if (!seen.has(id)) {
      seen.add(id);
      uniq.push(r);
    }
  }
  return uniq.slice(0, 3);
}

const QURAN_TRANSLATOR_LABELS = {
  161: 'তাইসীরুল কুরআন (তাওহীদ পাবলিকেশন)',
  162: 'রাওয়াই আল-বায়ান',
  163: 'ড. মুজিবুর রহমান',
  213: 'ড. আবু বকর মুহাম্মাদ যাকারিয়া',
  380: 'ফাতহুল মাজীদ',
};

function formatQuranVerseRecord(verseKey, arabicText, rawTranslations = []) {
  const [chStr, vStr] = String(verseKey || '').split(':');
  const chNum = Number(chStr);
  const surahBn = SURAH_NAME_BY_NUM.get(chNum) || `সূরা ${toBengaliDigits(chStr)}`;
  const verseKeyBn = `${toBengaliDigits(chStr)}:${toBengaliDigits(vStr)}`;
  const cleanAr = stripHtmlTags(arabicText || '');

  const pickedTrans = [];
  for (const tr of rawTranslations) {
    const cleanTxt = stripHtmlTags(tr.text || '');
    if (cleanTxt) {
      const label = QURAN_TRANSLATOR_LABELS[tr.resource_id] || tr.name || 'বাংলা অনুবাদ';
      pickedTrans.push({ label, text: cleanTxt });
      if (pickedTrans.length >= 2) break;
    }
  }

  if (!cleanAr && pickedTrans.length === 0) return null;

  const url = `https://quran.com/${chStr}/${vStr}`;
  const title = `আল-কুরআন — সূরা ${surahBn} (${verseKeyBn})`;
  const transLines = pickedTrans.map((t) => `বাংলা অনুবাদ (${t.label}): ${t.text}`).join('\n');

  return {
    source_site: 'Quran.com',
    source_name: 'Quran.com · আল-কুরআন',
    title,
    url,
    verse_key: verseKey,
    arabic: cleanAr,
    excerpt: pickedTrans[0] ? pickedTrans[0].text.slice(0, 320) : cleanAr.slice(0, 220),
    content: [
      `সূত্র: ${title} (${url})`,
      cleanAr ? `আরবি আয়াত: ${cleanAr}` : '',
      transLines,
    ]
      .filter(Boolean)
      .join('\n'),
    citation: `${title} — Quran.com (${url})`,
  };
}

export async function fetchQuranComSources(question, fetchImpl = fetch) {
  const results = [];
  const seenKeys = new Set();

  try {
    // 1. Direct verse / chapter lookups
    const directRefs = detectDirectQuranReferences(question);
    if (directRefs.length > 0) {
      const directFetches = await Promise.allSettled(
        directRefs.map(async (ref) => {
          if (ref.type === 'verse') {
            const apiUrl = `https://api.quran.com/api/v4/verses/by_key/${encodeURIComponent(
              ref.key
            )}?translations=161,213,163&fields=text_uthmani`;
            const res = await safeAllowedFetch(apiUrl, {}, 2400, fetchImpl);
            if (!res.ok) return [];
            const data = await res.json();
            const v = data?.verse;
            if (!v) return [];
            const item = formatQuranVerseRecord(v.verse_key || ref.key, v.text_uthmani, v.translations || []);
            return item ? [item] : [];
          } else {
            const apiUrl = `https://api.quran.com/api/v4/verses/by_chapter/${ref.chapter}?translations=161&fields=text_uthmani&per_page=7`;
            const res = await safeAllowedFetch(apiUrl, {}, 2400, fetchImpl);
            if (!res.ok) return [];
            const data = await res.json();
            const verses = Array.isArray(data?.verses) ? data.verses : [];
            if (!verses.length) return [];
            const surahBn = SURAH_NAME_BY_NUM.get(ref.chapter) || `সূরা ${toBengaliDigits(ref.chapter)}`;
            const combinedAr = verses.map((v) => `${stripHtmlTags(v.text_uthmani)} ﴿${toBengaliDigits(v.verse_number)}﴾`).join(' ');
            const combinedBn = verses
              .map((v) => `(${toBengaliDigits(v.verse_number)}) ${stripHtmlTags(v.translations?.[0]?.text || '')}`)
              .join(' ');
            const url = `https://quran.com/${ref.chapter}`;
            return [
              {
                source_site: 'Quran.com',
                source_name: 'Quran.com · আল-কুরআন',
                title: `আল-কুরআন — সূরা ${surahBn} (আয়াত ১–${toBengaliDigits(verses.length)})`,
                url,
                verse_key: `${ref.chapter}:1-${verses.length}`,
                arabic: combinedAr,
                excerpt: combinedBn.slice(0, 340),
                content: `সূত্র: সূরা ${surahBn} (${url})\nআরবি: ${combinedAr}\nবাংলা অনুবাদ (তাইসীরুল কুরআন): ${combinedBn}`,
                citation: `সূরা ${surahBn} — Quran.com (${url})`,
              },
            ];
          }
        })
      );

      for (const settled of directFetches) {
        if (settled.status === 'fulfilled' && Array.isArray(settled.value)) {
          for (const item of settled.value) {
            if (item && !seenKeys.has(item.verse_key)) {
              seenKeys.add(item.verse_key);
              results.push(item);
            }
          }
        }
      }
    }

    // 2. Full-text Bengali search on api.quran.com/api/v4/search when needed
    if (results.length < 2) {
      const { quranQuery } = extractCoreSearchQueries(question);
      if (quranQuery && quranQuery.length >= 2) {
        const searchUrl = `https://api.quran.com/api/v4/search?q=${encodeURIComponent(
          quranQuery
        )}&language=bn&size=3`;
        const res = await safeAllowedFetch(searchUrl, {}, 2500, fetchImpl);
        if (res.ok) {
          const data = await res.json();
          const hits = Array.isArray(data?.search?.results) ? data.search.results : [];
          for (const hit of hits) {
            const vKey = hit?.verse_key;
            if (!vKey || seenKeys.has(vKey)) continue;
            const bnTranslations = (hit.translations || []).filter(
              (t) => !t.language_name || String(t.language_name).toLowerCase() === 'bengali'
            );
            const item = formatQuranVerseRecord(
              vKey,
              hit.text,
              bnTranslations.length > 0 ? bnTranslations : hit.translations || []
            );
            if (item) {
              seenKeys.add(vKey);
              results.push(item);
              if (results.length >= 3) break;
            }
          }
        }
      }
    }
  } catch (_) {}

  return results.slice(0, 3);
}

export function parseHadithBdSearchHtml(html, allowWeak = false) {
  const raw = String(html || '');
  if (!raw) return [];

  // Match content anchors on hadithbd.com: /hadith/{book}/{num}, /books/{slug}/{id}, /dua/{slug}/{id}
  const linkRe =
    /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?hadithbd\.com)?(\/(?:hadith|books|dua)\/[a-z0-9_-]+\/[0-9]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  const candidates = [];
  const seenPaths = new Set();
  let match;

  while ((match = linkRe.exec(raw)) !== null) {
    const path = match[1];
    if (seenPaths.has(path)) continue;
    if (/\/(?:section|rabi|pdf|writter)\//i.test(path)) continue;

    const anchorTitle = stripHtmlTags(match[2]);
    if (!anchorTitle || anchorTitle.length < 3) continue;
    if (/^(?:পূর্ববর্তী|পরবর্তী|সব হাদিস|বিস্তারিত)$/u.test(anchorTitle)) continue;

    // Inspect nearby card text (~1500 chars after the anchor) for book name, hadith number, grade & snippet
    const windowHtml = raw.slice(match.index, match.index + 2400);
    const nextCardOffset = windowHtml.slice(match[0].length).search(
      /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?hadithbd\.com)?\/(?:hadith|books|dua)\/[a-z0-9_-]+\/[0-9]+["']/i
    );
    const cardHtml =
      nextCardOffset !== -1 ? windowHtml.slice(0, match[0].length + nextCardOffset) : windowHtml;
    const cardText = stripHtmlTags(cardHtml, true);

    const isWeakOrFabricated = /(?:যঈফ|যয়ীফ|দুর্বল|জাল|মওযূ|মুনকার|da'?if|weak|fabricated)/iu.test(cardText);
    if (isWeakOrFabricated && !allowWeak) {
      continue;
    }

    const isSahih = /(?:সহিহ|সহীহ|ছহীহ|sahih)/iu.test(cardText);
    const isHasan = /(?:হাসান|hasan)/iu.test(cardText);
    const kind = path.startsWith('/hadith/') ? 'hadith' : path.startsWith('/dua/') ? 'dua' : 'book';

    let priority = 10;
    if (kind === 'hadith' && isSahih) priority = 100;
    else if (kind === 'hadith' && isHasan) priority = 85;
    else if (kind === 'dua') priority = 75;
    else if (kind === 'hadith') priority = 65;
    else if (kind === 'book') priority = 55;

    // Clean English narration trailer from card snippet
    const cleanSnippet = cardText
      .replace(/আরবি ও ইংরেজি দেখুন/gu, '')
      .replace(/আরবি দেখুন/gu, '')
      .replace(/Narrated\s+[\s\S]*$/i, '')
      .trim()
      .slice(0, 650);

    seenPaths.add(path);
    candidates.push({
      path,
      url: `https://www.hadithbd.com${path}`,
      title: anchorTitle.slice(0, 180),
      kind,
      grade: isSahih ? 'সহিহ (Sahih)' : isHasan ? 'হাসান (Hasan)' : '',
      priority,
      snippet: cleanSnippet,
    });

    if (candidates.length >= 10) break;
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

export function extractHadithBdDetailContent(html, fallbackTitle = '') {
  const raw = String(html || '');
  if (!raw) return null;

  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch
    ? stripHtmlTags(titleMatch[1])
        .replace(/\s*\|\s*Sahih[\s\S]*$/i, '')
        .replace(/\s*\|\s*হাদিসবিডি[\s\S]*$/u, '')
        .trim()
    : fallbackTitle;

  const plainLines = stripHtmlTags(raw, true);

  // Locate start of main Hadith / Book content
  let body = plainLines;
  const markersStart = ['পরিচ্ছেদঃ', 'ভুল পেলে রিপোর্ট করুন', 'আরবী/ইংরেজি'];
  for (const mk of markersStart) {
    const idx = body.indexOf(mk);
    if (idx !== -1) {
      body = mk === 'পরিচ্ছেদঃ' ? body.slice(idx) : body.slice(idx + mk.length);
      break;
    }
  }

  // Trim footer / navigation noise
  const markersEnd = [
    'পুনঃনিরীক্ষণঃ',
    'পূর্ববর্তী হাদিস',
    'পূর্ববর্তী পাতা',
    'পড়ার সেটিংস',
    'গ্রন্থ ও অনুচ্ছেদে যান',
  ];
  for (const mk of markersEnd) {
    const idx = body.indexOf(mk);
    if (idx > 60) {
      body = body.slice(0, idx);
    }
  }

  // Strip English duplicate block while keeping Bengali + Arabic + grade
  body = body
    .replace(/\n(?:Narrated|Abu Huraira said|Ibn 'Umar said|[A-Z][a-z]+ reported)[\s\S]*?(?=\nহাদিসের মানঃ|$)/g, '\n')
    .trim();

  if (body.length < 40) return null;
  return {
    pageTitle: pageTitle || fallbackTitle,
    content: body.slice(0, 1750),
  };
}

export async function fetchHadithBdSources(question, fetchImpl = fetch) {
  const allowWeak = /(?:যঈফ|যয়ীফ|দুর্বল|জাল|মওযূ)/u.test(question);
  const { hadithQuery } = extractCoreSearchQueries(question);
  if (!hadithQuery || hadithQuery.length < 2) return [];

  try {
    const searchUrl = `https://www.hadithbd.com/search/?q=${encodeURIComponent(hadithQuery)}`;
    let searchRes = await safeAllowedFetch(searchUrl, {}, 2500, fetchImpl);
    let html = searchRes.ok ? await searchRes.text() : '';
    let candidates = parseHadithBdSearchHtml(html, allowWeak);

    // Fallback to top 2 keywords if a 3-5 word phrase yielded 0 hits
    const words = hadithQuery.split(/\s+/);
    if (candidates.length === 0 && words.length >= 3) {
      const shorter = words.slice(0, 2).join(' ');
      const retryUrl = `https://www.hadithbd.com/search/?q=${encodeURIComponent(shorter)}`;
      searchRes = await safeAllowedFetch(retryUrl, {}, 2000, fetchImpl);
      if (searchRes.ok) {
        html = await searchRes.text();
        candidates = parseHadithBdSearchHtml(html, allowWeak);
      }
    }

    if (candidates.length === 0) return [];

    const topPicks = candidates.slice(0, 2);
    const detailSettled = await Promise.allSettled(
      topPicks.map(async (cand) => {
        try {
          const dRes = await safeAllowedFetch(cand.url, {}, 2100, fetchImpl);
          if (!dRes.ok) return null;
          const dHtml = await dRes.text();
          return extractHadithBdDetailContent(dHtml, cand.title);
        } catch (_) {
          return null;
        }
      })
    );

    return topPicks.map((cand, idx) => {
      const detail = detailSettled[idx]?.status === 'fulfilled' ? detailSettled[idx].value : null;
      const finalTitle = (detail?.pageTitle || cand.title).slice(0, 180);
      const finalBody = detail?.content || cand.snippet;
      const badgeLabel = cand.grade ? `HadithBD · ${cand.grade}` : 'HadithBD (বাংলা হাদিস)';

      return {
        source_site: 'HadithBD',
        source_name: badgeLabel,
        title: finalTitle,
        url: cand.url,
        grade: cand.grade,
        excerpt: finalBody.replace(/\s+/g, ' ').slice(0, 300),
        content: `সূত্র: ${finalTitle} — বাংলা হাদিস (${cand.url})\n${finalBody}`,
        citation: `${finalTitle} — HadithBD (${cand.url})`,
      };
    });
  } catch (_) {
    return [];
  }
}

export async function fetchVerifiedExternalIslamicSources(question, fetchImpl = fetch) {
  const q = String(question || '').trim();
  if (!q || q.length < 2) return [];

  // Skip greetings / pure small-talk
  if (
    q.length <= 36 &&
    /^(?:আসসালামু|সালাম|হ্যালো|হাই|কেমন আছ|ধন্যবাদ|জাযাকাল্লাহ|আলহামদুলিল্লাহ|শুভ সকাল|assalamu|salam|hello|hi|thanks)(?=$|\s|[?!।,.])/iu.test(
      q
    )
  ) {
    return [];
  }

  const ceiling = new Promise((resolve) => setTimeout(() => resolve(null), 3300));
  const bothPromise = Promise.allSettled([
    fetchQuranComSources(q, fetchImpl),
    fetchHadithBdSources(q, fetchImpl),
  ]);

  const settled = await Promise.race([bothPromise, ceiling]);
  if (!settled) return [];

  const quranItems = settled[0]?.status === 'fulfilled' ? settled[0].value : [];
  const hadithItems = settled[1]?.status === 'fulfilled' ? settled[1].value : [];

  // Interleave best HadithBD & Quran.com evidences (max 4 external blocks total)
  const combined = [];
  const maxLen = Math.max(quranItems.length, hadithItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (hadithItems[i]) combined.push(hadithItems[i]);
    if (quranItems[i]) combined.push(quranItems[i]);
  }
  return combined.slice(0, 4);
}
