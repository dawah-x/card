/**
 * DAWAH X AI — Strictly Allowlisted Verified External Islamic Sources (v20.0)
 *
 * ONLY permits outbound retrieval from the user's explicitly approved official Islamic sources:
 *   1. Quran.com (`https://quran.com/`, `https://api.quran.com/api/v4`, `https://verses.quran.com/`)
 *   2. HadithBD / বাংলা হাদিস (`https://www.hadithbd.com/`)
 *   3. DAWAH X (`https://ebrahim-ead.github.io/DAWAH-X/`)
 *
 * v20.0 Enhancements:
 *   - Complete 114-Surah Bengali + Banglish + English catalog
 *   - Automatic scholarly Bengali Tafsir (`তাফসীর আবু বকর যাকারিয়া` #166 / `ইবন কাসীর` #164) from api.quran.com
 *   - Official Quran.com Mishary Rashid Alafasy verse audio URLs (`verses.quran.com/Alafasy/mp3/...`)
 *   - Banglish -> Bengali Islamic term transliterator ("foroj gosol", "sahu sijda", "janajar dua", etc.)
 *   - Direct HadithBD book+number fast-resolver (`বুখারী ১২২৪` -> `/hadith/bukhari/1224` in 1 round-trip)
 *   - Full reader-ready text payload (`full_text`, `arabic`) for in-app slide-over reading
 */

export const ALLOWED_SOURCE_HOSTS = new Set([
  'api.quran.com',
  'quran.com',
  'www.quran.com',
  'verses.quran.com',
  'verses.quran.foundation',
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

// Complete 114 Surahs of the Holy Quran: [number, Bengali name, aliases]
export const SURAH_CATALOG = [
  [1, 'আল-ফাতিহা', ['ফাতিহা', 'ফাতেহা', 'fatiha', 'fatihah']],
  [2, 'আল-বাকারা', ['বাকারা', 'বাকারাহ', 'baqara', 'baqarah']],
  [3, 'আলে ইমরান', ['আলে ইমরান', 'আল ইমরান', 'ইমরান', 'ali imran', 'imran']],
  [4, 'আন-নিসা', ['নিসা', 'নেসা', 'nisa']],
  [5, 'আল-মায়িদাহ', ['মায়িদা', 'মায়েদা', 'মায়িদাহ', 'maidah', 'maida']],
  [6, 'আল-আনআম', ['আনআম', 'আনয়াম', 'anam']],
  [7, 'আল-আরাফ', ['আরাফ', 'araf']],
  [8, 'আল-আনফাল', ['আনফাল', 'anfal']],
  [9, 'আত-তাওবাহ', ['সূরা তাওবা', 'সুরা তাওবা', 'তাওবাহ', 'সুরা তওবা', 'tawbah', 'taubah']],
  [10, 'ইউনুস', ['ইউনুস', 'yunus']],
  [11, 'হূদ', ['সূরা হুদ', 'সুরা হুদ', 'হূদ', 'surah hud']],
  [12, 'ইউসুফ', ['ইউসুফ', 'yusuf']],
  [13, 'আর-রাদ', ['রাদ', 'রা’দ', 'rad']],
  [14, 'ইবরাহীম', ['ইবরাহিম', 'ইবরাহীম', 'ibrahim']],
  [15, 'আল-হিজর', ['হিজর', 'hijr']],
  [16, 'আন-নাহল', ['নাহল', 'nahl']],
  [17, 'বনী ইসরাঈল (আল-ইসরা)', ['ইসরা', 'বনী ইসরাঈল', 'বনি ইসরাইল', 'isra', 'bani israil']],
  [18, 'আল-কাহফ', ['কাহফ', 'কাহাফ', 'kahf', 'kahaf']],
  [19, 'মারইয়াম', ['মারইয়াম', 'মরিয়ম', 'maryam', 'mariam']],
  [20, 'ত্বা-হা', ['ত্বাহা', 'তাহা', 'ত্বা-হা', 'taha']],
  [21, 'আল-আম্বিয়া', ['আম্বিয়া', 'ambiya', 'anbiya']],
  [22, 'আল-হাজ্জ', ['সূরা হজ্জ', 'সুরা হজ্জ', 'সূরা হাজ্জ', 'surah hajj']],
  [23, 'আল-মুমিনূন', ['মুমিনুন', 'মুমিনূন', 'muminun']],
  [24, 'আন-নূর', ['সূরা নূর', 'সুরা নূর', 'সূরা নুর', 'আন-নূর', 'surah nur', 'surah noor']],
  [25, 'আল-ফুরকান', ['ফুরকান', 'furqan']],
  [26, 'আশ-শুআরা', ['শুআরা', 'শুয়ারা', 'shuara']],
  [27, 'আন-নামল', ['নামল', 'naml']],
  [28, 'আল-কাসাস', ['কাসাস', 'ক্বাসাস', 'qasas']],
  [29, 'আল-আনকাবূত', ['আনকাবুত', 'আনকাবূত', 'ankabut']],
  [30, 'আর-রূম', ['রূম', 'সূরা রুম', 'সুরা রুম', 'surah rum']],
  [31, 'লুকমান', ['লুকমান', 'লোকমান', 'luqman']],
  [32, 'আস-সাজদাহ', ['সূরা সাজদা', 'সুরা সাজদা', 'আস-সাজদাহ', 'surah sajdah']],
  [33, 'আল-আহযাব', ['আহযাব', 'আহজাব', 'ahzab']],
  [34, 'সাবা', ['সূরা সাবা', 'সুরা সাবা', 'surah saba']],
  [35, 'ফাতির', ['ফাতির', 'ফাতের', 'fatir']],
  [36, 'ইয়াসীন', ['ইয়াসিন', 'ইয়াসীন', 'ইয়াসিন', 'yasin', 'yaseen']],
  [37, 'আস-সাফফাত', ['সাফফাত', 'saffat']],
  [38, 'সোয়াদ', ['সোয়াদ', 'সূরা সাদ', 'সুরা সাদ', 'surah sad']],
  [39, 'আয-যুমার', ['যুমার', 'জুমার', 'zumar']],
  [40, 'গাফির (মুমিন)', ['গাফির', 'সূরা মুমিন', 'সুরা মুমিন', 'ghafir']],
  [41, 'ফুসসিলাত', ['ফুসসিলাত', 'হা-মীম সাজদা', 'fussilat']],
  [42, 'আশ-শূরা', ['শূরা', 'শুরা', 'shura']],
  [43, 'আয-যুখরুফ', ['যুখরুফ', 'জুখরুফ', 'zukhruf']],
  [44, 'আদ-দুখান', ['দুখান', 'দোখান', 'dukhan']],
  [45, 'আল-জাসিয়াহ', ['জাসিয়া', 'জাসিয়াহ', 'jathiyah', 'jasiyah']],
  [46, 'আল-আহকাফ', ['আহকাফ', 'ahqaf']],
  [47, 'মুহাম্মাদ', ['সূরা মুহাম্মাদ', 'সুরা মুহাম্মদ', 'সূরা মুহাম্মদ', 'surah muhammad']],
  [48, 'আল-ফাতহ', ['ফাতহ', 'ফাতাহ', 'fath']],
  [49, 'আল-হুজুরাত', ['হুজুরাত', 'হুজরাত', 'hujurat']],
  [50, 'ক্বাফ', ['সূরা ক্বাফ', 'সূরা কাফ', 'সুরা কাফ', 'surah qaf']],
  [51, 'আয-যারিয়াত', ['যারিয়াত', 'জারিয়াত', 'dhariyat', 'zariyat']],
  [52, 'আত-তূর', ['সূরা তূর', 'সুরা তুর', 'আত-তূর', 'surah tur']],
  [53, 'আন-নাজম', ['নাজম', 'নজম', 'najm']],
  [54, 'আল-কামার', ['কামার', 'ক্বামার', 'qamar']],
  [55, 'আর-রহমান', ['আর রহমান', 'আর-রহমান', 'সূরা রহমান', 'সুরা রহমান', 'surah rahman', 'ar rahman']],
  [56, 'আল-ওয়াকিয়াহ', ['ওয়াকিয়া', 'ওয়াকিয়াহ', 'ওয়াক্বিয়াহ', 'waqiah', 'waqia']],
  [57, 'আল-হাদীদ', ['হাদীদ', 'হাদিদ', 'hadid']],
  [58, 'আল-মুজাদালাহ', ['মুজাদালা', 'মুজাদালাহ', 'mujadilah', 'mujadalah']],
  [59, 'আল-হাশর', ['হাশর', 'hashr']],
  [60, 'আল-মুমতাহিনাহ', ['মুমতাহিনা', 'মুমতাহিনাহ', 'mumtahanah']],
  [61, 'আস-সাফ', ['সূরা সাফ', 'সুরা সফ', 'আস-সাফ', 'surah saff']],
  [62, 'আল-জুমুআহ', ['সূরা জুমুআ', 'সূরা জুম্মা', 'সুরা জুমুআহ', 'আল-জুমুআহ', 'surah jumuah']],
  [63, 'আল-মুনাফিকূন', ['মুনাফিকুন', 'মুনাফিকূন', 'munafiqun']],
  [64, 'আত-তাগাবুন', ['তাগাবুন', 'taghabun']],
  [65, 'আত-তালাক', ['সূরা তালাক', 'সুরা তালাক', 'আত-তালাক', 'surah talaq']],
  [66, 'আত-তাহরীম', ['তাহরীম', 'তাহরিম', 'tahrim']],
  [67, 'আল-মুলক', ['মুলক', 'সূরা মুলক', 'সুরা মুলক', 'mulk']],
  [68, 'আল-কলম', ['সূরা কলম', 'সুরা কলম', 'আল-কলম', 'surah qalam']],
  [69, 'আল-হাক্কাহ', ['হাক্কাহ', 'হাক্কা', 'haqqah']],
  [70, 'আল-মাআরিজ', ['মাআরিজ', 'মা’আরিজ', 'maarij']],
  [71, 'নূহ', ['সূরা নূহ', 'সুরা নুহ', 'surah nuh']],
  [72, 'আল-জিন', ['সূরা জিন', 'সুরা জ্বীন', 'আল-জিন', 'surah jinn']],
  [73, 'আল-মুযযাম্মিল', ['মুযযাম্মিল', 'মুজ্জাম্মিল', 'muzzammil']],
  [74, 'আল-মুদ্দাসসির', ['মুদ্দাসসির', 'মুদ্দাস্সির', 'muddathir', 'muddassir']],
  [75, 'আল-কিয়ামাহ', ['সূরা কিয়ামাহ', 'সুরা কিয়ামাহ', 'আল-কিয়ামাহ', 'surah qiyamah']],
  [76, 'আল-ইনসান (আদ-দাহর)', ['সূরা ইনসান', 'সূরা দাহর', 'আল-ইনসান', 'surah insan', 'surah dahr']],
  [77, 'আল-মুরসালাত', ['মুরসালাত', 'mursalat']],
  [78, 'আন-নাবা', ['নাবা', 'আম্মা', 'naba']],
  [79, 'আন-নাযিআত', ['নাযিয়াত', 'নাযিআত', 'naziat']],
  [80, 'আবাসা', ['আবাসা', 'abasa']],
  [81, 'আত-তাকভীর', ['তাকভীর', 'তাকবীর সূরা', 'takwir']],
  [82, 'আল-ইনফিতার', ['ইনফিতার', 'infitar']],
  [83, 'আল-মুতাফফিফীন', ['মুতাফফিফীন', 'মুতাফফিফিন', 'mutaffifin']],
  [84, 'আল-ইনশিকাক', ['ইনশিকাক', 'inshiqaq']],
  [85, 'আল-বুরূজ', ['বুরুজ', 'বুরূজ', 'buruj']],
  [86, 'আত-তারিক', ['তারিক', 'ত্বারিক', 'tariq']],
  [87, 'আল-আলা', ['সূরা আলা', 'সুরা আলা', 'আল-আলা', 'surah ala']],
  [88, 'আল-গাশিয়াহ', ['গাশিয়া', 'গাশিয়াহ', 'ghashiyah']],
  [89, 'আল-ফজর', ['সূরা ফজর', 'সুরা ফজর', 'আল-ফজর', 'surah fajr']],
  [90, 'আল-বালাদ', ['বালাদ', 'balad']],
  [91, 'আশ-শামস', ['সূরা শামস', 'সুরা শামস', 'আশ-শামস', 'surah shams']],
  [92, 'আল-লাইল', ['সূরা লাইল', 'সুরা লাইল', 'আল-লাইল', 'surah lail', 'surah layl']],
  [93, 'আদ-দুহা', ['দুহা', 'দোহা', 'আদ-দুহা', 'duha']],
  [94, 'আল-ইনশিরাহ', ['ইনশিরাহ', 'আলাম নাশরাহ', 'সূরা শারহ', 'inshirah', 'sharh']],
  [95, 'আত-তীন', ['সূরা তীন', 'সুরা তিন', 'আত-তীন', 'surah tin']],
  [96, 'আল-আলাক', ['আলাক', 'সূরা ইকরা', 'alaq']],
  [97, 'আল-কদর', ['সূরা কদর', 'সুরা কদর', 'আল-কদর', 'surah qadr']],
  [98, 'আল-বাইয়্যিনাহ', ['বাইয়্যিনা', 'বাইয়্যিনাহ', 'bayyinah']],
  [99, 'আয-যিলযাল', ['যিলযাল', 'জিলজাল', 'zilzal', 'zalzalah']],
  [100, 'আল-আদিয়াত', ['আদিয়াত', 'adiyat']],
  [101, 'আল-কারিআহ', ['কারিয়া', 'কারিআহ', 'qariah']],
  [102, 'আত-তাকাসুর', ['তাকাসুর', 'takathur', 'takasur']],
  [103, 'আল-আসর', ['সূরা আসর', 'সুরা আসর', 'আল আসর', 'আল-আসর', 'surah asr']],
  [104, 'আল-হুমাযাহ', ['হুমাযা', 'হুমাজা', 'হুমাযাহ', 'humazah']],
  [105, 'আল-ফীল', ['সূরা ফীল', 'সুরা ফিল', 'আল-ফীল', 'surah fil']],
  [106, 'কুরাইশ', ['কুরাইশ', 'কোরাইশ', 'quraish']],
  [107, 'আল-মাউন', ['মাউন', 'মাঊন', 'maun']],
  [108, 'আল-কাউসার', ['কাউসার', 'কাওসার', 'kawthar', 'kausar']],
  [109, 'আল-কাফিরূন', ['কাফিরুন', 'কাফিরূন', 'kafirun']],
  [110, 'আন-নাসর', ['সূরা নাসর', 'সুরা নাসর', 'আন-নাসর', 'surah nasr']],
  [111, 'আল-লাহাব (আল-মাসাদ)', ['সূরা লাহাব', 'সুরা লাহাব', 'মাসাদ', 'lahab', 'masad']],
  [112, 'আল-ইখলাস', ['ইখলাস', 'এখলাস', 'ikhlas']],
  [113, 'আল-ফালাক', ['ফালাক', 'ফালাক্ব', 'falaq']],
  [114, 'আন-নাস', ['সূরা নাস', 'সুরা নাস', 'আন নাস', 'আন-নাস', 'surah nas']],
];

const SURAH_NAME_BY_NUM = new Map(SURAH_CATALOG.map(([num, name]) => [num, name]));

// Banglish -> Bengali Islamic term converter so Latin-script queries hit Quran.com & HadithBD accurately
const BANGLISH_ISLAMIC_MAP = [
  [/\bayatul\s*kursi\b/gi, 'আয়াতুল কুরসী'],
  [/\bsahu\s*sijda[h]?\b|\bsijda(?:ye)?\s*sahu\b/gi, 'সাহু সিজদা'],
  [/\bforoj\s*gosol(?:er)?\b|\bfarz\s*ghusl\b|\bgosol(?:er)?\b/gi, 'ফরয গোসল'],
  [/\boju\s*vangar\b|\bozu\s*bhangar\b|\bwudu\b|\boju\b|\bozu\b/gi, 'ওযু'],
  [/\btayammum\b/gi, 'তায়াম্মুম'],
  [/\bnamaj(?:e|er)?\b|\bnamaz(?:e|er)?\b|\bsalat(?:e|er)?\b/gi, 'সালাত'],
  [/\broja(?:r)?\b|\broza(?:r)?\b|\bsiam\b|\bsiyam\b/gi, 'রোজা সিয়াম'],
  [/\bzakat(?:er)?\b|\bjakat(?:er)?\b/gi, 'যাকাত'],
  [/\bfitra[h]?\b/gi, 'ফিতরা'],
  [/\bqurbani\b|\bkurbani\b/gi, 'কুরবানী'],
  [/\bakika[h]?\b|\baqiqa[h]?\b/gi, 'আকীকা'],
  [/\bjanaja(?:r)?\b|\bjanaza(?:r)?\b/gi, 'জানাযা'],
  [/\btahajjud(?:er)?\b/gi, 'তাহাজ্জুদ'],
  [/\btarabi[h]?\b|\btaraweeh\b/gi, 'তারাবীহ'],
  [/\bwitr\b|\bbitor(?:er)?\b|\bbitr\b/gi, 'বিতর'],
  [/\bistikhara(?:r)?\b|\bistekhara(?:r)?\b/gi, 'ইস্তিখারা'],
  [/\bdua\b|\bdoa\b/gi, 'দোয়া'],
  [/\bghumanor\b/gi, 'ঘুমানোর'],
  [/\btalak\b|\btalaq\b/gi, 'তালাক'],
  [/\bsud(?:er)?\b|\briba\b/gi, 'সুদ রিবা'],
  [/\bporda(?:r)?\b|\bhijab\b/gi, 'পর্দা হিজাব'],
  [/\bdari\b|\bbeard\b/gi, 'দাড়ি'],
  [/\btawba[h]?\b|\btauba[h]?\b/gi, 'তাওবা'],
  [/\bshirk\b/gi, 'শিরক'],
  [/\bbidat\b|\bbidah\b/gi, 'বিদআত'],
  [/\bkobor\b|\bqabar\b/gi, 'কবর'],
  [/\bjannat\b/gi, 'জান্নাত'],
  [/\bjahannam\b/gi, 'জাহান্নাম'],
  [/\bniyom\b|\bpoddhoti\b/gi, 'নিয়ম'],
  [/\bkaron\b/gi, 'কারণ'],
  [/\bortho\b|\bmeaning\b/gi, 'অর্থ'],
  [/\btafsir\b|\btafseer\b/gi, 'তাফসীর'],
];

export function normalizeBanglishIslamicTerms(input) {
  let s = String(input || '');
  if (!/[a-zA-Z]/.test(s)) return s;
  for (const [re, bn] of BANGLISH_ISLAMIC_MAP) {
    s = s.replace(re, bn);
  }
  return s;
}

export function buildQuranAudioUrl(chapterNum, verseNum) {
  const c = Number(chapterNum);
  const v = Number(verseNum);
  if (!Number.isInteger(c) || !Number.isInteger(v) || c < 1 || c > 114 || v < 1 || v > 286) return '';
  return `https://verses.quran.com/Alafasy/mp3/${String(c).padStart(3, '0')}${String(v).padStart(3, '0')}.mp3`;
}

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
        'User-Agent': 'DAWAH-X-AI/20.0 (+https://ebrahim-ead.github.io/DAWAH-X/)',
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
  'তাফসীর',
  'তাফসির',
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
  'ki',
  'kivabe',
  'keno',
]);

// Direct HadithBD slug table for 1-hop fast Hadith lookup
const HADITHBD_BOOK_SLUGS = [
  [/সহ[ীি]হ\s*বুখার[ীি]|বুখার[ীি]|bukhari/iu, 'bukhari'],
  [/সহ[ীি]হ\s*মুসলিম|মুসলিম|muslim/iu, 'muslim'],
  [/আব[ূু]\s*দা[উঊ]দ|abu\s*dawu?d|abudawud/iu, 'abu-dawud'],
  [/তিরমি[যজ][ীি]|tirmidhi|tirmizi/iu, 'tirmidhi'],
  [/নাসা(?:য়|য়|ঈ)[ীি]?|nasai/iu, 'nasai'],
  [/ইবন[ুে]?\s*মাজাহ?|ibn\s*majah?/iu, 'ibn-majah'],
  [/মিশকাত|mishkat/iu, 'mishkat'],
  [/রি(?:য়া|য়া)[যদ]ুস\s*(?:সালেহ[ীি]ন|স্বা-লিহীন)|riyadus/iu, 'riyadus-salihin'],
  [/আদাবুল\s*মুফরাদ|adab\s*al\s*mufrad/iu, 'adab-al-mufrad'],
  [/বুলুগুল\s*মারাম|bulugh?ul/iu, 'bulughul-maram'],
  [/ন(?:ব|ও)(?:ব|য়া|য়া)ব?[ীি]র?\s*(?:চল্লিশ|40)\s*হাদ[ীি]স|nawawi/iu, 'nawawi40'],
  [/হাদ[ীি]সে?\s*কুদস[ীি]|qudsi/iu, 'qudsi40'],
  [/মু(?:ও|ওয়া|ওয়া)ত্তা|muwatta/iu, 'muwatta-malik'],
  [/শামা(?:য়|য়)েলে?\s*তিরমি[যজ][ীি]|shamail/iu, 'shamail-muhammadiyah'],
];

export function detectDirectHadithReference(question) {
  const asciiQ = toAsciiDigits(normalizeBanglishIslamicTerms(question));
  for (const [re, slug] of HADITHBD_BOOK_SLUGS) {
    const m = asciiQ.match(
      new RegExp(`(?:${re.source})\\s*(?:এর|তে|হাদীস|হাদিস|নং|নম্বর|তম|ম|য়|য়|হা\\/|#|:|-)*\\s*(\\d{1,5})(?=$|[^0-9])`, 'iu')
    );
    if (m) {
      const num = Number(m[1]);
      if (num >= 1 && num <= 15000) {
        return {
          slug,
          num,
          url: `https://www.hadithbd.com/hadith/${slug}/${num}`,
          searchFallback: `${m[0].replace(/\s+/g, ' ').trim()}`,
        };
      }
    }
  }
  return null;
}

export function extractCoreSearchQueries(question) {
  const normalizedInput = normalizeBanglishIslamicTerms(question);
  const cleaned = String(normalizedInput || '')
    .normalize('NFC')
    .replace(/[?!।,.;:'"“”‘’()[\]{}\/\\|+*=~`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { hadithQuery: '', quranQuery: '' };

  const directH = detectDirectHadithReference(cleaned);
  if (directH) {
    return { hadithQuery: directH.searchFallback, quranQuery: directH.searchFallback };
  }

  const tokens = cleaned
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()));

  const coreTokens = (tokens.length > 0 ? tokens : cleaned.split(' ')).slice(0, 5);
  const hadithQuery = coreTokens.join(' ').trim();

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
  const asciiQ = toAsciiDigits(normalizeBanglishIslamicTerms(String(question || '').normalize('NFC')));
  const lowerQ = asciiQ.toLowerCase();
  const refs = [];

  if (/আ(?:য়|য়)াতুল\s*কুরস[ীি]|আ(?:য়|য়)াতুল\s*কুরছ[ীি]/iu.test(asciiQ)) {
    refs.push({ type: 'verse', key: '2:255' });
  }
  if (/বাকারার?\s*শেষ\s*(?:দুই|2|দুটি)\s*আ(?:য়|য়)াত/iu.test(asciiQ)) {
    refs.push({ type: 'verse', key: '2:285' });
    refs.push({ type: 'verse', key: '2:286' });
  }
  if (/হাশরের?\s*শেষ\s*(?:তিন|3|তিনটি)\s*আ(?:য়|য়)াত/iu.test(asciiQ)) {
    refs.push({ type: 'verse', key: '59:22' });
    refs.push({ type: 'verse', key: '59:23' });
    refs.push({ type: 'verse', key: '59:24' });
  }
  if (/কাহ(?:া)?ফের?\s*প্রথম\s*(?:দশ|10)\s*(?:টি\s*)?আ(?:য়|য়)াত/iu.test(asciiQ)) {
    for (let v = 1; v <= 5; v++) refs.push({ type: 'verse', key: `18:${v}` });
  }

  const colonMatches = asciiQ.matchAll(/(?:^|[^\d])(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?=$|[^\d])/g);
  for (const m of colonMatches) {
    const ch = Number(m[1]);
    const vStart = Number(m[2]);
    const vEnd = m[3] ? Math.min(Number(m[3]), vStart + 4) : vStart;
    if (ch >= 1 && ch <= 114 && vStart >= 1 && vStart <= 286) {
      for (let v = vStart; v <= vEnd; v++) {
        refs.push({ type: 'verse', key: `${ch}:${v}` });
      }
    }
  }

  for (const [surahNum, , aliases] of SURAH_CATALOG) {
    for (const alias of aliases) {
      if (lowerQ.includes(alias.toLowerCase())) {
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
        } else if (surahNum === 1 || surahNum >= 87) {
          refs.push({ type: 'chapter', chapter: surahNum });
        }
        break;
      }
    }
  }

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

async function fetchQuranTafsirSnippet(verseKey, fetchImpl = fetch) {
  // Resource 166: Tafsir Abu Bakr Zakaria (Bengali), fallback 164: Tafsir Ibn Kathir (Bengali)
  for (const tafsirId of [166, 164]) {
    try {
      const url = `https://api.quran.com/api/v4/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`;
      const res = await safeAllowedFetch(url, {}, 2000, fetchImpl);
      if (!res.ok) continue;
      const data = await res.json();
      const rawTxt = data?.tafsir?.text || '';
      const cleanTxt = stripHtmlTags(rawTxt, true);
      if (cleanTxt && cleanTxt.length >= 40) {
        const tafsirName =
          tafsirId === 166 ? 'তাফসীর ড. আবু বকর মুহাম্মাদ যাকারিয়া' : 'তাফসীর ইবন কাসীর (বাংলা)';
        return { name: tafsirName, text: cleanTxt.slice(0, 1100) };
      }
    } catch (_) {}
  }
  return null;
}

function formatQuranVerseRecord(verseKey, arabicText, rawTranslations = [], tafsirObj = null) {
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
  const audioUrl = buildQuranAudioUrl(chNum, Number(vStr));
  const title = `আল-কুরআন — সূরা ${surahBn} (${verseKeyBn})`;
  const transLines = pickedTrans.map((t) => `বাংলা অনুবাদ (${t.label}): ${t.text}`).join('\n\n');
  const tafsirLine = tafsirObj ? `\n\nসংক্ষিপ্ত তাফসীর (${tafsirObj.name}):\n${tafsirObj.text}` : '';

  const fullReaderText = [
    cleanAr ? `${cleanAr}` : '',
    transLines,
    tafsirObj ? `তাফসীর (${tafsirObj.name}):\n${tafsirObj.text}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    source_site: 'Quran.com',
    source_name: tafsirObj ? `Quran.com · অনুবাদ ও তাফসীর` : 'Quran.com · আল-কুরআন',
    title,
    url,
    audio_url: audioUrl,
    verse_key: verseKey,
    arabic: cleanAr,
    excerpt: pickedTrans[0] ? pickedTrans[0].text.slice(0, 300) : cleanAr.slice(0, 220),
    full_text: fullReaderText.slice(0, 2200),
    content: [
      `সূত্র: ${title} (${url})`,
      cleanAr ? `আরবি আয়াত: ${cleanAr}` : '',
      transLines + tafsirLine,
    ]
      .filter(Boolean)
      .join('\n'),
    citation: `${title} — Quran.com (${url})`,
  };
}

export async function fetchQuranComSources(question, fetchImpl = fetch) {
  const results = [];
  const seenKeys = new Set();
  const wantsTafsir = /(?:তাফস[ীি]র|ব্যাখ্যা|শানে\s*নু[যজ][ুূ]ল|ফ[যজ][ীি]লত|শিক্ষা|tafsir|tafseer)/iu.test(question);

  try {
    const directRefs = detectDirectQuranReferences(question);
    if (directRefs.length > 0) {
      const directFetches = await Promise.allSettled(
        directRefs.map(async (ref, idx) => {
          if (ref.type === 'verse') {
            const apiUrl = `https://api.quran.com/api/v4/verses/by_key/${encodeURIComponent(
              ref.key
            )}?translations=161,213,163&fields=text_uthmani`;
            const [res, tafsirObj] = await Promise.all([
              safeAllowedFetch(apiUrl, {}, 2400, fetchImpl),
              idx === 0 ? fetchQuranTafsirSnippet(ref.key, fetchImpl) : Promise.resolve(null),
            ]);
            if (!res.ok) return [];
            const data = await res.json();
            const v = data?.verse;
            if (!v) return [];
            const item = formatQuranVerseRecord(
              v.verse_key || ref.key,
              v.text_uthmani,
              v.translations || [],
              tafsirObj
            );
            return item ? [item] : [];
          } else {
            const apiUrl = `https://api.quran.com/api/v4/verses/by_chapter/${ref.chapter}?translations=161&fields=text_uthmani&per_page=8`;
            const res = await safeAllowedFetch(apiUrl, {}, 2400, fetchImpl);
            if (!res.ok) return [];
            const data = await res.json();
            const verses = Array.isArray(data?.verses) ? data.verses : [];
            if (!verses.length) return [];
            const surahBn = SURAH_NAME_BY_NUM.get(ref.chapter) || `সূরা ${toBengaliDigits(ref.chapter)}`;
            const combinedAr = verses
              .map((v) => `${stripHtmlTags(v.text_uthmani)} ﴿${toBengaliDigits(v.verse_number)}﴾`)
              .join(' ');
            const combinedBn = verses
              .map((v) => `(${toBengaliDigits(v.verse_number)}) ${stripHtmlTags(v.translations?.[0]?.text || '')}`)
              .join(' ');
            const url = `https://quran.com/${ref.chapter}`;
            const audioUrl = buildQuranAudioUrl(ref.chapter, 1);
            return [
              {
                source_site: 'Quran.com',
                source_name: 'Quran.com · আল-কুরআন',
                title: `আল-কুরআন — সূরা ${surahBn} (আয়াত ১–${toBengaliDigits(verses.length)})`,
                url,
                audio_url: audioUrl,
                verse_key: `${ref.chapter}:1-${verses.length}`,
                arabic: combinedAr,
                excerpt: combinedBn.slice(0, 320),
                full_text: `${combinedAr}\n\nবাংলা অনুবাদ (তাইসীরুল কুরআন):\n${combinedBn}`.slice(0, 2200),
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
          let topHitTafsir = null;
          if (wantsTafsir && hits[0]?.verse_key) {
            topHitTafsir = await fetchQuranTafsirSnippet(hits[0].verse_key, fetchImpl);
          }
          for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            const vKey = hit?.verse_key;
            if (!vKey || seenKeys.has(vKey)) continue;
            const bnTranslations = (hit.translations || []).filter(
              (t) => !t.language_name || String(t.language_name).toLowerCase() === 'bengali'
            );
            const item = formatQuranVerseRecord(
              vKey,
              hit.text,
              bnTranslations.length > 0 ? bnTranslations : hit.translations || [],
              i === 0 ? topHitTafsir : null
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

  // Match content anchors on hadithbd.com: /hadith/{book}/{num}, /books/{slug}/{id}, /dua/{slug}, /terms/{slug}
  const linkRe =
    /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?hadithbd\.com)?(\/(?:(?:hadith|books)\/[a-z0-9_-]+\/[0-9]+|(?:dua|terms)\/[a-z0-9_-]+(?:\/[0-9]+)?))["'][^>]*>([\s\S]*?)<\/a>/gi;

  const candidates = [];
  const seenPaths = new Set();
  let match;

  while ((match = linkRe.exec(raw)) !== null) {
    const path = match[1];
    if (seenPaths.has(path)) continue;
    if (/\/(?:section|rabi|pdf|writter)\//i.test(path)) continue;

    const anchorTitle = stripHtmlTags(match[2]);
    if (!anchorTitle || anchorTitle.length < 3) continue;
    if (/^(?:পূর্ববর্তী|পরবর্তী|সব হাদিস|বিস্তারিত|দুয়া ও জিকির|ইসলামি পরিভাষা)$/u.test(anchorTitle)) continue;

    const windowHtml = raw.slice(match.index, match.index + 2400);
    const nextCardOffset = windowHtml.slice(match[0].length).search(
      /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?hadithbd\.com)?\/(?:hadith|books|dua|terms)\/[a-z0-9_-]+/i
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
    const kind = path.startsWith('/hadith/')
      ? 'hadith'
      : path.startsWith('/dua/')
        ? 'dua'
        : path.startsWith('/terms/')
          ? 'terms'
          : 'book';

    let priority = 10;
    if (kind === 'hadith' && isSahih) priority = 100;
    else if (kind === 'hadith' && isHasan) priority = 85;
    else if (kind === 'dua') priority = 78;
    else if (kind === 'hadith') priority = 65;
    else if (kind === 'terms') priority = 60;
    else if (kind === 'book') priority = 55;

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

  let body = plainLines;
  const markersStart = ['পরিচ্ছেদঃ', 'ভুল পেলে রিপোর্ট করুন', 'আরবী/ইংরেজি'];
  for (const mk of markersStart) {
    const idx = body.indexOf(mk);
    if (idx !== -1) {
      body = mk === 'পরিচ্ছেদঃ' ? body.slice(idx) : body.slice(idx + mk.length);
      break;
    }
  }

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

  body = body
    .replace(/\n(?:Narrated|Abu Huraira said|Ibn 'Umar said|[A-Z][a-z]+ reported)[\s\S]*?(?=\nহাদিসের মানঃ|$)/g, '\n')
    .trim();

  if (body.length < 40) return null;
  const detectedGrade = /(?:হাদিসের মানঃ\s*)(সহিহ|সহীহ|হাসান|যঈফ)[^\n]*/iu.exec(body);

  return {
    pageTitle: pageTitle || fallbackTitle,
    grade: detectedGrade ? detectedGrade[1] : '',
    content: body.slice(0, 1950),
  };
}

export async function fetchHadithBdSources(question, fetchImpl = fetch) {
  const allowWeak = /(?:যঈফ|যয়ীফ|দুর্বল|জাল|মওযূ)/u.test(question);

  try {
    // 1. Fast 1-hop direct Hadith lookup (e.g., "বুখারী ১২২৪" -> https://www.hadithbd.com/hadith/bukhari/1224)
    const directRef = detectDirectHadithReference(question);
    if (directRef) {
      try {
        const directRes = await safeAllowedFetch(directRef.url, {}, 2200, fetchImpl);
        if (directRes.ok) {
          const dHtml = await directRes.text();
          const detail = extractHadithBdDetailContent(dHtml, `${directRef.slug} ${directRef.num}`);
          if (detail && detail.content) {
            const gradeStr = detail.grade || '';
            return [
              {
                source_site: 'HadithBD',
                source_name: gradeStr ? `HadithBD · ${gradeStr}` : 'HadithBD (বাংলা হাদিস)',
                title: detail.pageTitle,
                url: directRef.url,
                grade: gradeStr,
                excerpt: detail.content.replace(/\s+/g, ' ').slice(0, 300),
                full_text: detail.content,
                content: `সূত্র: ${detail.pageTitle} — বাংলা হাদিস (${directRef.url})\n${detail.content}`,
                citation: `${detail.pageTitle} — HadithBD (${directRef.url})`,
              },
            ];
          }
        }
      } catch (_) {}
    }

    // 2. Full HadithBD search + parallel full-page extraction
    const { hadithQuery } = extractCoreSearchQueries(question);
    if (!hadithQuery || hadithQuery.length < 2) return [];

    const searchUrl = `https://www.hadithbd.com/search/?q=${encodeURIComponent(hadithQuery)}`;
    let searchRes = await safeAllowedFetch(searchUrl, {}, 2500, fetchImpl);
    let html = searchRes.ok ? await searchRes.text() : '';
    let candidates = parseHadithBdSearchHtml(html, allowWeak);

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
      const finalGrade = cand.grade || detail?.grade || '';
      const badgeLabel = finalGrade ? `HadithBD · ${finalGrade}` : 'HadithBD (বাংলা হাদিস)';

      return {
        source_site: 'HadithBD',
        source_name: badgeLabel,
        title: finalTitle,
        url: cand.url,
        grade: finalGrade,
        excerpt: finalBody.replace(/\s+/g, ' ').slice(0, 300),
        full_text: finalBody.slice(0, 2200),
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

  const ceiling = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
  const bothPromise = Promise.allSettled([
    fetchQuranComSources(q, fetchImpl),
    fetchHadithBdSources(q, fetchImpl),
  ]);

  const settled = await Promise.race([bothPromise, ceiling]);
  if (!settled) return [];

  const quranItems = settled[0]?.status === 'fulfilled' ? settled[0].value : [];
  const hadithItems = settled[1]?.status === 'fulfilled' ? settled[1].value : [];

  // If user explicitly asked about a Quranic Surah/Ayah/Tafsir, place Quran.com first; otherwise interleave HadithBD + Quran.com
  const isExplicitQuranQuery =
    detectDirectQuranReferences(q).length > 0 || /(?:সূরা|সুরা|আয়াত|কুরআন|তাফসীর|তাফসির|surah|ayah|quran)/iu.test(q);

  const combined = [];
  const maxLen = Math.max(quranItems.length, hadithItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (isExplicitQuranQuery) {
      if (quranItems[i]) combined.push(quranItems[i]);
      if (hadithItems[i]) combined.push(hadithItems[i]);
    } else {
      if (hadithItems[i]) combined.push(hadithItems[i]);
      if (quranItems[i]) combined.push(quranItems[i]);
    }
  }
  return combined.slice(0, 4);
}
