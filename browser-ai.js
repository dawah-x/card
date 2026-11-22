/* ===== DAWAH X AI — Full Client-Side Browser AI Engine (GitHub Pages Ready) =====
 * Powers https://dawah-x.github.io/card/ 100% serverlessly by reading live verified
 * indices & full texts from https://ebrahim-ead.github.io/DAWAH-X/ (with automatic
 * fallback to raw.githubusercontent.com/Ebrahim-ead/DAWAH-X/main).
 */
(function (root) {
  'use strict';

  const PRIMARY_BASE = 'https://ebrahim-ead.github.io/DAWAH-X';
  const FALLBACK_BASE = 'https://raw.githubusercontent.com/Ebrahim-ead/DAWAH-X/main';
  const SITE_URL = PRIMARY_BASE;

  const SOURCE_NAMES = {
    at: 'মাসিক আত-তাহরীক',
    ai: 'মাসিক আল-ইতিছাম',
    ik: 'মাসিক আল-ইখলাছ',
    fm: 'From Muslims',
    ra: 'Response to Anti-Islam',
    iz: 'Insight Zone',
    ia: 'Islamic Authors',
  };

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const FOLD_MAP = {
    'ী': 'ি', 'ূ': 'ু', 'ঈ': 'ই', 'ঊ': 'উ',
    'ছ': 'স', 'শ': 'স', 'ষ': 'স', 'য': 'জ', 'ণ': 'ন', 'ৎ': 'ত',
  };
  const LEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function bnToEnDigits(s) {
    return String(s || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  }

  // Exact match with DAWAH X's foldBn()
  function foldBn(v) {
    return bnToEnDigits(String(v || '').normalize('NFC').toLowerCase())
      .replace(/[\u200b-\u200d\u00ad\ufeff\u0981]/g, '')
      .replace(/([\p{L}\p{M}])[‘’'ʼ`ʻ](?=\p{L})/gu, '$1')
      .replace(/\u09af\u09bc/g, '\u09df')
      .replace(/\u09a1\u09bc/g, '\u09dc')
      .replace(/\u09a2\u09bc/g, '\u09dd')
      .replace(/([কত])\u09cd\u09ac/g, '$1')
      .replace(/[ীূঈঊছশষযণৎ]/g, (c) => FOLD_MAP[c]);
  }

  const D_FINAL_ROOTS = new Set(
    [
      'মসজিদ', 'মাসজিদ', 'তাওহীদ', 'তৌহিদ', 'জিহাদ', 'সুদ', 'ঈদ', 'সনদ',
      'সম্পদ', 'বিপদ', 'মতভেদ', 'অপবাদ', 'অনুবাদ', 'সংবাদ', 'ফাসাদ',
      'ইজতিহাদ', 'তাকলীদ', 'মুরতাদ', 'দাঊদ', 'মাহমূদ', 'মাজীদ', 'হামীদ', 'প্রাসাদ', 'পরিষদ',
    ].map(foldBn)
  );

  const BN_SUFFIXES = [
    'গুলোর', 'গুলোকে', 'গুলোতে', 'গুলোয়', 'গুলো',
    'সমূহের', 'সমূহকে', 'সমূহে', 'সমূহ',
    'দেরকে', 'দেরই', 'দের',
    'গুলোই', 'টাকেই', 'টাকে', 'টিকে', 'টির', 'টার', 'টিতে', 'টাতে',
    'গুলোও', 'খানার', 'খানা',
    'কারীর', 'কারীকে', 'কারীদের', 'কারী',
    'ভাবেই', 'ভাবে', 'কালীন',
    'তেও', 'কেও', 'য়েও', 'নের', 'য়ের',
    'তে', 'কে', 'য়', 'য়ে',
  ].map(foldBn);

  function stemBn(token) {
    const n = token.length;
    if (n <= 3 || /^\d+$/.test(token)) return token;
    if (token.endsWith('দের') && D_FINAL_ROOTS.has(token.slice(0, -2))) {
      return token.slice(0, -2);
    }
    for (const suf of BN_SUFFIXES) {
      if (n - suf.length >= 3 && token.endsWith(suf)) {
        return token.slice(0, -suf.length);
      }
    }
    if (n >= 6 && token.endsWith('ের') && token.length - 2 >= 4) {
      return token.slice(0, -2);
    }
    if (n >= 6 && token.endsWith('ির')) {
      return token.slice(0, -1);
    }
    if (
      n >= 6 &&
      (token.endsWith('ার') || token.endsWith('ুর')) &&
      !/(?:কার|বার|চার|পার|দার)$/.test(token)
    ) {
      return token.slice(0, -1);
    }
    return token;
  }

  const COMPOUND_BN_REPLACEMENTS = [
    [/পিতামাতা/gu, 'পিতা মাতা'],
    [/মাবাবা|বাবামা/gu, 'মা বাবা পিতা মাতা'],
    [/স্বামীস্ত্রী/gu, 'স্বামী স্ত্রী'],
    [/ভাইবোন/gu, 'ভাই বোন'],
    [/ছেলেমেয়ে|ছেলেমেয়ে/gu, 'ছেলে মেয়ে'],
    [/শবেবরাত/gu, 'শবে বরাত'],
    [/শবেকদর/gu, 'শবে কদর'],
    [/ঈদুলফিতর/gu, 'ঈদুল ফিতর'],
    [/ঈদুলআযহা|ঈদুলআজহা/gu, 'ঈদুল আযহা'],
    [/আয়াতুলকুরসী|আয়াতুলকুরসি/gu, 'আয়াতুল কুরসী'],
    [/সিজদায়েসাহু/gu, 'সিজদায়ে সাহু'],
  ];

  function expandCompoundsBn(text) {
    let s = String(text || '');
    for (const [re, rep] of COMPOUND_BN_REPLACEMENTS) {
      s = s.replace(re, rep);
    }
    return s;
  }

  function tokenizeFolded(text, doStem = true) {
    const folded = foldBn(expandCompoundsBn(text)).replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, ' ');
    const raw = folded.match(/[\p{L}\p{M}\p{N}]+/gu) || [];
    const out = [];
    for (const tok of raw) {
      const cpLen = [...tok].length;
      if (cpLen < 2 || cpLen > 30) continue;
      if (/^\d{5,}$/.test(tok)) continue;
      out.push(doStem ? stemBn(tok) : tok);
    }
    return out;
  }

  function searchPrefix(t) {
    const a = [...t];
    return a.slice(0, a[1] === '\u09cd' ? 5 : 3).join('');
  }

  function shardOf(t, numShards) {
    let h = 0x811c9dc5;
    const p = searchPrefix(t);
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ((h >>> 0) % 512) % numShards;
  }

  function decodeIds(b64) {
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = [];
    let v = 0, sh = 0, prev = -1;
    for (let i = 0; i < bin.length; i++) {
      const c = bin.charCodeAt(i);
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

  // Synonym groups & Banglish/English Islamic domain dictionary
  const RAW_SYNONYM_GROUPS = [
    ['নামাজ', 'নামায', 'সালাত', 'ছালাত'],
    ['রোজা', 'রোযা', 'সিয়াম', 'ছিয়াম', 'সাওম', 'ছাওম'],
    ['কোরআন', 'কুরআন', 'কোরান', 'কুরান'],
    ['হাদিস', 'হাদীস', 'হাদীছ', 'সুন্নাহ', 'সুন্নাত'],
    ['অজু', 'ওজু', 'উজু', 'ওযু', 'ওযূ'],
    ['গোসল', 'জানাবাত', 'নাপাকি'],
    ['দোয়া', 'দোআ', 'দুআ', 'দুয়া', 'মুনাজাত', 'মোনাজাত'],
    ['জুমা', 'জুমআ', 'জুমুআ'],
    ['কুরবানি', 'কোরবানি', 'কুরবানী'],
    ['আকিকা', 'আকীকা'],
    ['যাকাত', 'জাকাত'],
    ['নিসাব', 'নিছাব'],
    ['ফিতরা', 'ফেতরা'],
    ['সদকা', 'সাদাকাহ', 'দান'],
    ['ওহি', 'অহি', 'ওয়াহী'],
    ['জয়িফ', 'জইফ', 'যঈফ'],
    ['সহিহ', 'সহীহ', 'ছহীহ'],
    ['বিদআত', 'বেদাত', 'বিদআহ'],
    ['শিরক', 'শিরিক'],
    ['কুফর', 'কাফের', 'কাফির'],
    ['তাওহীদ', 'তৌহিদ', 'তাওহিদ', 'একত্ববাদ'],
    ['আকিদা', 'আকীদা', 'ঈমান', 'বিশ্বাস'],
    ['ফেরেসতা', 'ফিরিসতা', 'ফেরেশতা'],
    ['রাসুল', 'রসুল', 'রাসূল', 'নবী', 'মুহাম্মদ', 'মুহাম্মাদ', 'মোহাম্মদ'],
    ['রাকাত', 'রাকআত'],
    ['সিজদা', 'সেজদা', 'সাজদা'],
    ['হজ্জ', 'হজ', 'হজ্ব'],
    ['ওমরা', 'উমরা', 'উমরাহ'],
    ['মসজিদ', 'মাসজিদ'],
    ['বিতর', 'বিতির', 'বেতের'],
    ['তারাবি', 'তারাবীহ'],
    ['তাহাজ্জুদ', 'কিয়ামুল'],
    ['সেহরি', 'সাহরি', 'সাহারি', 'সাহরী'],
    ['বিয়ে', 'বিবাহ', 'নিকাহ'],
    ['তালাক', 'ডিভোর্স', 'বিবাহবিচ্ছেদ'],
    ['খুলা', 'খোলা'],
    ['মোহর', 'দেনমোহর', 'মাহর'],
    ['পর্দা', 'হিজাব', 'নিকাব', 'বোরকা', 'মাহরাম'],
    ['নারী', 'মহিলা', 'স্ত্রী'],
    ['স্রষ্টা', 'সৃষ্টিকর্তা', 'আল্লাহ', 'রব', 'ঈশ্বর'],
    ['নাস্তিক', 'নাস্তিকতা', 'অবিশ্বাসী', 'সংশয়বাদী', 'সংশয়'],
    ['তাকদীর', 'তাকদির', 'ভাগ্য', 'নিয়তি'],
    ['আখিরাত', 'পরকাল', 'কিয়ামত', 'জান্নাত', 'জাহান্নাম'],
    ['কবর', 'মাজার', 'যিয়ারত', 'জিয়ারত'],
    ['সুদ', 'রিবা'],
    ['ভ্যাট', 'ট্যাক্স', 'কর'],
    ['গান', 'বাদ্যযন্ত্র', 'মিউজিক', 'সংগীত', 'বাজনা'],
    ['ছবি', 'মূর্তি', 'ভাস্কর্য', 'ফটোগ্রাফি'],
    ['দাড়ি', 'শ্মশ্রু'],
    ['টাখনু', 'ইসাবাল', 'প্যান্ট'],
    ['তাবিজ', 'তাবীয', 'কবজ', 'ঝাড়ফুঁক', 'রুকইয়াহ', 'যাদু'],
    ['হালাল', 'জায়েয', 'জায়েজ', 'বৈধ'],
    ['হারাম', 'নাজায়েয', 'নিষিদ্ধ', 'অবৈধ', 'গুনাহ', 'পাপ'],
    ['ফরজ', 'ফরয', 'ওয়াজিব'],
    ['তওবা', 'তাওবা', 'ইস্তিগফার', 'ক্ষমা'],
    ['মিরাস', 'উত্তরাধিকার', 'ওয়ারিশ'],
    ['ইনজেকশন', 'ইঞ্জেকশন', 'স্যালাইন'],
    ['ভঙ্গ', 'ভঙ্গের', 'ভাঙ্গা', 'ভাঙ্গার', 'ভাঙা', 'ভাঙার', 'ভেঙে', 'ভাঙে', 'নষ্ট'],
    ['মনোযোগ', 'খুশু', 'খুযু', 'একাগ্রতা', 'মন'],
    ['কাযা', 'ক্বাযা', 'কাজা'],
    ['অপবিত্র', 'নাপাক', 'জুনুবী', 'জানাবাত'],
    ['হায়েয', 'ঋতুস্রাব', 'পিরিয়ড', 'মাসিক'],
    ['আযাব', 'আজাব', 'শাস্তি'],
    ['ফযীলত', 'ফজিলত', 'মর্যাদা', 'সওয়াব', 'নেকি'],
    ['বহুবিবাহ', 'একাধিক', 'চারটি'],
    ['ক্যাশব্যাক', 'ডিসকাউন্ট', 'ছাড়'],
    ['নিয়ম', 'পদ্ধতি', 'বিবরণ'],
    ['আয়েশা', 'আয়িশা'],
    ['জানাযা', 'জানাজা', 'মাইয়্যেত'],
    ['আমল', 'আদব', 'সুন্নাত'],
    ['বিষন্নতা', 'হতাশা', 'দুশ্চিন্তা', 'অশান্তি'],
    ['বিবর্তনবাদ', 'ডারউইনবাদ', 'ডারউইন'],
    ['আত্মহত্যা', 'সুইসাইড'],
  ];

  const SYNONYM_MAP = new Map();
  for (const grp of RAW_SYNONYM_GROUPS) {
    const words = new Set();
    for (const p of grp) {
      const f = foldBn(p).trim();
      if (!f.includes(' ') && f.length >= 2) {
        words.add(f);
        words.add(stemBn(f));
      }
    }
    for (const w of words) {
      if (!SYNONYM_MAP.has(w)) SYNONYM_MAP.set(w, new Set());
      for (const o of words) {
        if (o !== w) SYNONYM_MAP.get(w).add(o);
      }
    }
  }

  // Comprehensive Banglish & English -> Bengali Islamic + Everyday Vocabulary
  const BANGLISH_AND_EN_MAP = {
    // Worship & Salah
    namaz: 'নামাজ সালাত', namaj: 'নামাজ সালাত', salat: 'সালাত নামাজ', salah: 'সালাত নামাজ',
    prayer: 'সালাত নামাজ দোয়া', pray: 'সালাত নামাজ', wudu: 'ওযু অজু', oju: 'ওজু ওযু',
    ozu: 'ওযু ওজু', ablution: 'ওযু পবিত্রতা', gosol: 'গোসল ফরয', gusul: 'গোসল ফরয',
    ghusl: 'গোসল ফরয', bath: 'গোসল', tayammum: 'তায়াম্মুম',
    fajr: 'ফজর সালাত', fazar: 'ফজর সালাত', fojor: 'ফজর সালাত',
    johor: 'যোহর সালাত', dhuhr: 'যোহর সালাত', zuhr: 'যোহর সালাত',
    asor: 'আসর সালাত', asr: 'আসর সালাত', magrib: 'মাগরিব সালাত', maghrib: 'মাগরিব সালাত',
    esha: 'এশা সালাত', isha: 'এশা সালাত', tahajjud: 'তাহাজ্জুদ সালাত',
    tarabi: 'তারাবীহ সালাত', tarawih: 'তারাবীহ সালাত', witr: 'বিতর সালাত', bitor: 'বিতর সালাত', vitir: 'বিতর সালাত',
    juma: 'জুমআ সালাত', jumma: 'জুমআ সালাত', jumuah: 'জুমআ সালাত', janaza: 'জানাযা সালাত তাকবীর দুআ', janazah: 'জানাযা সালাত তাকবীর দুআ',
    rakat: 'রাকআত', rakaat: 'রাকআত', sijdah: 'সিজদা সাহু', sijda: 'সিজদা সাহু', sejda: 'সিজদা',
    sahu: 'সাহু সিজদা', ruku: 'রুকু', tashahhud: 'তাশাহহুদ', salam_namaz: 'সালাম',
    imam: 'ইমাম জামাআত', jamat: 'জামাআত সালাত', jamaat: 'জামাআত সালাত', muazzin: 'মুয়াজ্জিন আযান',
    masjid: 'মসজিদ', mosque: 'মসজিদ', azan: 'আযান', adhan: 'আযান', iqamah: 'ইকামত',
    kaza: 'কাযা ক্বাযা ছালাত', qaza: 'কাযা ক্বাযা ছালাত', qada: 'কাযা আদায়',
    mon: 'মন মনোযোগ খুশু', khushu: 'খুশু মনোযোগ সালাত', focus: 'মনোযোগ খুশু সালাত',
    // Fasting, Zakat, Hajj
    dua: 'দোয়া দুআ', doa: 'দোয়া দুআ', zikir: 'যিকির', dhikr: 'যিকির', tasbih: 'তাসবীহ যিকির',
    roja: 'রোজা সিয়াম', roza: 'রোজা সিয়াম', siyam: 'সিয়াম রোজা', saum: 'সাওম রোজা',
    fasting: 'রোজা সিয়াম', fast: 'রোজা সিয়াম', ramadan: 'রমযান রোজা', ramzan: 'রমযান রোজা',
    sehri: 'সাহরী সেহরি', suhoor: 'সাহরী সেহরি', iftar: 'ইফতার রোজা',
    fidya: 'ফিদইয়া রোজা', kaffara: 'কাফফারা রোজা', itikaf: 'ইতিকাফ',
    zakat: 'যাকাত নিসাব', jakat: 'যাকাত নিসাব', nisab: 'নিসাব যাকাত', fitra: 'ফিতরা সদকাতুল ফিতর',
    sadaqah: 'সাদাকাহ দান', sadaka: 'সাদাকাহ দান', charity: 'দান সাদাকাহ যাকাত', ushr: 'উশর যাকাত',
    hajj: 'হজ্জ হজ', hoj: 'হজ্জ হজ', umrah: 'উমরাহ ওমরা', omra: 'উমরাহ ওমরা',
    qurbani: 'কুরবানী পশু', kurbani: 'কুরবানী', korbani: 'কুরবানী', aqiqah: 'আকীকা', akika: 'আকীকা',
    // Aqeedah, Quran, Hadith, Dawah, Science
    allah: 'আল্লাহ স্রষ্টা', god: 'আল্লাহ স্রষ্টা অস্তিত্ব', creator: 'স্রষ্টা আল্লাহর অস্তিত্ব',
    exist: 'অস্তিত্ব প্রমাণ', existence: 'আল্লাহর অস্তিত্ব প্রমাণ',
    atheist: 'নাস্তিক নাস্তিকতা সংশয়', atheism: 'নাস্তিকতা আল্লাহর অস্তিত্ব', nastik: 'নাস্তিক নাস্তিকতা',
    agnostic: 'সংশয়বাদী নাস্তিকতা', secular: 'ধর্মনিরপেক্ষতা',
    evolution: 'বিবর্তনবাদ বিজ্ঞান ডারউইন', biborton: 'বিবর্তনবাদ ডারউইন', science: 'বিজ্ঞান কুরআন',
    evil: 'দুঃখ কষ্ট তাকদীর পরীক্ষা', suffering: 'দুঃখ কষ্ট তাকদীর',
    taqdeer: 'তাকদীর ভাগ্য', takdir: 'তাকদীর ভাগ্য', fate: 'তাকদীর ভাগ্য', destiny: 'তাকদীর ভাগ্য',
    akhirat: 'আখিরাত পরকাল বিচার', hereafter: 'আখিরাত পরকাল', qiyamah: 'কিয়ামত পরকাল', kiyamot: 'কিয়ামত',
    jannah: 'জান্নাত', jannat: 'জান্নাত', jahannam: 'জাহান্নাম', hell: 'জাহান্নাম', heaven: 'জান্নাত',
    kobor: 'কবর আযাব যিয়ারত', grave: 'কবর যিয়ারত আযাব', azab: 'আযাব শাস্তি', ajab: 'আযাব শাস্তি',
    quran: 'কুরআন আয়াত সংকলন', koran: 'কুরআন আয়াত', surah: 'সূরা কুরআন', sura: 'সূরা কুরআন', ayat: 'আয়াত কুরআন',
    kahf: 'কাহফ সূরা', yasin: 'ইয়াসীন সূরা', mulk: 'মুলক সূরা', kursi: 'আয়াতুল কুরসী',
    hadith: 'হাদীস সুন্নাহ সহীহ', hadis: 'হাদিস সুন্নাহ', sunnah: 'সুন্নাহ হাদীস', sunnat: 'সুন্নাত সুন্নাহ',
    prophet: 'রাসূল মুহাম্মাদ নবী', muhammad: 'মুহাম্মাদ রাসূল', rasul: 'রাসূল নবী', nabi: 'নবী রাসূল',
    noor: 'নূর মাটি রাসূল', mati: 'মাটি নূর তৈরি',
    shirk: 'শিরক তাওহীদ', bidat: 'বিদআত সুন্নাহ', bidah: 'বিদআত', milad: 'মীলাদ বিদআত কিয়াম',
    shobe: 'শবে বরাত শাবান', borat: 'শবে বরাত শাবান', meraj: 'মিরাজ ইসরা',
    tawheed: 'তাওহীদ আকীদা', tauhid: 'তাওহীদ', iman: 'ঈমান আকীদা', aqeedah: 'আকীদা বিশ্বাস', akida: 'আকীদা',
    // Family, Women, Purity, Social
    biye: 'বিবাহ বিয়ে নিকাহ', bibaho: 'বিবাহ বিয়ে', nikah: 'নিকাহ বিবাহ', marriage: 'বিবাহ বিয়ে স্ত্রী',
    polygamy: 'বহুবিবাহ চারটি বিবাহ', bohubibaho: 'বহুবিবাহ চারটি বিবাহ', wives: 'চারটি বিবাহ বহুবিবাহ',
    talaq: 'তালাক বিবাহবিচ্ছেদ', talak: 'তালাক', divorce: 'তালাক খুলা', khula: 'খুলা তালাক', halala: 'হালালা তালাক',
    mohor: 'মোহর দেনমোহর', denmohor: 'দেনমোহর মোহর', mehr: 'মোহর দেনমোহর', iddat: 'ইদ্দত',
    bou: 'স্ত্রী স্বামী সংসার', swami: 'স্বামী স্ত্রী', shami: 'স্বামী স্ত্রী', wife: 'স্ত্রী স্বামী', husband: 'স্বামী স্ত্রী',
    women: 'নারী অধিকার পর্দা', nari: 'নারী মহিলা পর্দা', mohila: 'মহিলা নারী', meye: 'মেয়ে নারী কন্যা',
    feminism: 'নারীবাদ নারী অধিকার', hijab: 'পর্দা হিজাব নিকাব', niqab: 'নিকাব পর্দা হিজাব', porda: 'পর্দা হিজাব',
    mahram: 'মাহরাম পর্দা', cousin: 'চাচাতো খালাতো ফুফাতো মামাতো মাহরাম বিবাহ',
    period: 'হায়েয পিরিয়ড ঋতুস্রাব', hayez: 'হায়েয পিরিয়ড ঋতুস্রাব', nifas: 'নিফাস প্রসূতি',
    junub: 'জুনুবী অপবিত্র গোসল', napak: 'নাপাক অপবিত্র পবিত্রতা', pobitro: 'পবিত্রতা ওযু গোসল',
    swapnodosh: 'স্বপ্নদোষ বীর্য গোসল ছিয়াম', masturbation: 'হস্তমৈথুন বীর্য গুনাহ', hostomoithun: 'হস্তমৈথুন গুনাহ',
    // Finance, Halal-Haram, Lifestyle
    riba: 'সুদ রিবা ব্যাংক', shud: 'সুদ রিবা', sud: 'সুদ রিবা', interest: 'সুদ ব্যাংক লোন',
    bank: 'ব্যাংক সুদ একাউন্ট', loan: 'ঋণ লোন সুদ', taka: 'টাকা অর্থ সম্পদ', takar: 'টাকা অর্থ সম্পদ',
    bkash: 'বিকাশ ক্যাশব্যাক মোবাইল ব্যাংকিং', nagad: 'নগদ বিকাশ ক্যাশব্যাক', cashback: 'ক্যাশব্যাক ডিসকাউন্ট মূল্য ফেরত',
    bitcoin: 'বিটকয়েন ক্রিপ্টোকারেন্সি মুদ্রা', crypto: 'ক্রিপ্টোকারেন্সি বিটকয়েন অনলাইন',
    freelancing: 'ফ্রিল্যান্সিং আয় উপার্জন', share: 'শেয়ার বাজার ব্যবসা', insurance: 'বীমা ইনস্যুরেন্স',
    ghush: 'ঘুষ দুর্নীতি হারাম', bribe: 'ঘুষ হারাম', जुয়া: 'জুয়া লটারি', lottery: 'লটারি জুয়া হারাম', betting: 'জুয়া বাজি হারাম',
    tax: 'ট্যাক্স ভ্যাট', vat: 'ভ্যাট ট্যাক্স', miras: 'মিরাস উত্তরাধিকার সম্পত্তি', inheritance: 'মিরাস উত্তরাধিকার সম্পত্তি',
    music: 'গান বাদ্যযন্ত্র মিউজিক হারাম', gan: 'গান বাদ্যযন্ত্র', gaan: 'গান বাদ্যযন্ত্র', song: 'গান বাদ্যযন্ত্র',
    photo: 'ছবি মূর্তি ফটোগ্রাফি ভিডিও', chobi: 'ছবি মূর্তি ভিডিও', picture: 'ছবি মূর্তি',
    beard: 'দাড়ি শ্মশ্রু', dari: 'দাড়ি শ্মশ্রু', pant: 'প্যান্ট টাখনু পোশাক', takhnu: 'টাখনু গিরা প্যান্ট লুঙ্গি',
    eyebrow: 'ভ্রু প্লাক সৌন্দর্য', pluck: 'ভ্রু প্লাক লোম', tattoo: 'ট্যাটু উল্কি', gold: 'স্বর্ণ সোনা পুরুষ যাকাত',
    smoking: 'ধূমপান সিগারেট জর্দা নেশা', sigaret: 'সিগারেট ধূমপান', cigarette: 'সিগারেট ধূমপান', alcohol: 'মদ নেশা হারাম',
    dog: 'কুকুর পালা ফেরেশতা', kukur: 'কুকুর পালা', cat: 'বিড়াল প্রাণী পালা',
    tabij: 'তাবিজ ঝাড়ফুঁক শিরক', ruqyah: 'রুকইয়াহ ঝাড়ফুঁক', jadu: 'যাদু ব্ল্যাক ম্যাজিক শিরক', sihr: 'যাদু টোনা',
    mazar: 'মাজার কবর শিরক ওরস', birthday: 'জন্মদিন পালন বিদআত', newyear: 'নববর্ষ থার্টি ফার্স্ট বিদআত',
    valentine: 'ভ্যালেন্টাইন দিবস বেহায়াপনা',
    // Parents, Sin, Repentance, Mental Peace, Sharia, Extra Banglish
    baba: 'পিতা মাতা বাবা মা', ma: 'মা পিতা মাতা সন্তান', parents: 'পিতা মাতা সন্তান হক',
    suicide: 'আত্মহত্যা গুনাহ হতাশা', attahotta: 'আত্মহত্যা গুনাহ হতাশা', attohotta: 'আত্মহত্যা গুনাহ হতাশা',
    depression: 'বিষন্নতা হতাশা মানসিক অশান্তি', dipression: 'বিষন্নতা হতাশা মানসিক অশান্তি',
    manoshik: 'মানসিক বিষন্নতা অশান্তি', oshanti: 'অশান্তি বিষন্নতা হতাশা', mukti: 'পরিত্রাণ মুক্তি উপায়',
    upay: 'উপায় করণীয় প্রতিকার', prokar: 'প্রকার শ্রেণিবিভাগ', kake: 'কাকে সংজ্ঞা পরিচয়',
    hotasha: 'হতাশা বিষন্নতা সবর', bibortonbad: 'বিবর্তনবাদ ডারউইনবাদ নাস্তিকতা', darwin: 'ডারউইনবাদ বিবর্তনবাদ',
    aisha: 'আয়েশা আয়িশা বিবাহ বয়স', ayesha: 'আয়েশা আয়িশা বিবাহ বয়স', age: 'বয়স বিবাহ',
    allow: 'বাধা পরীক্ষা হিকমত', porokiya: 'পরকীয়া যিনা ব্যভিচার', zina: 'যিনা ব্যভিচার পরকীয়া', jina: 'যিনা ব্যভিচার',
    vanga: 'ভঙ্গ নষ্ট কারণ', vangar: 'ভঙ্গ নষ্ট কারণ', bhanga: 'ভঙ্গ নষ্ট কারণ', bhangar: 'ভঙ্গ নষ্ট কারণ',
    tauba: 'তওবা ক্ষমা গুনাহ ইস্তিগফার', tawbah: 'তওবা ক্ষমা গুনাহ', istighfar: 'ইস্তিগফার ক্ষমা তওবা',
    gunah: 'গুনাহ পাপ ক্ষমা তওবা', sin: 'গুনাহ পাপ তওবা', forgive: 'ক্ষমা তওবা রহমত',
    jihad: 'জিহাদ কিতাল সন্ত্রাসবাদ', slavery: 'দাসপ্রথা দাসী যুদ্ধবন্দী', apostate: 'মুরতাদ ধর্মত্যাগ শাস্তি', murtad: 'মুরতাদ ধর্মত্যাগ',
    halal: 'হালাল জায়েয বৈধ', haram: 'হারাম নাজায়েয নিষিদ্ধ', jayej: 'জায়েয বৈধ', najayez: 'নাজায়েয হারাম',
    foroj: 'ফরয আবশ্যক', farz: 'ফরয আবশ্যক বিধান', fard: 'ফরয আবশ্যক বিধান', wajib: 'ওয়াজিব ফরয', makruh: 'মাকরূহ',
    karon: 'কারণ ভঙ্গ শর্ত', venge: 'ভঙ্গ ভেঙে নষ্ট', bhenge: 'ভঙ্গ ভেঙে নষ্ট', nosto: 'নষ্ট ভঙ্গ',
    sothik: 'সঠিক সহীহ সুন্নাহ', sahih: 'সহীহ বিশুদ্ধ হাদীস', daif: 'যঈফ দুর্বল হাদীস',
    injection: 'ইনজেকশন স্যালাইন ছিয়াম', saline: 'স্যালাইন ইনজেকশন ছিয়াম', medicine: 'ঔষধ চিকিৎসা রোজা',
  };

  // Everyday Banglish grammatical/function words that should NEVER be treated as unmatched Latin topic words
  const BANGLISH_STOP_WORDS = new Set([
    'a', 'e', 'te', 'er', 'r', 'ke', 're', 'ta', 'ti', 'gulo', 'gula', 'ra', 'der',
    'ki', 'kii', 'keno', 'kn', 'kno', 'kokhon', 'kkhn', 'kivabe', 'kibhabe', 'kemne', 'kemon', 'kmn',
    'koto', 'koy', 'koyta', 'kon', 'konta', 'konoti', 'kothay', 'kothai', 'keu', 'karo', 'kake',
    'hoy', 'hoi', 'hobe', 'hole', 'hoile', 'howa', 'howar', 'hocche', 'hoise', 'hoyeche', 'holo',
    'jay', 'jai', 'jabe', 'gele', 'jawa', 'jawar', 'pare', 'parbo', 'parbe', 'pari', 'para',
    'kora', 'korar', 'kore', 'korle', 'korbo', 'korben', 'korte', 'koren', 'kori',
    'dewa', 'dewar', 'dite', 'dile', 'debo', 'dei', 'newa', 'newar', 'nite', 'nile', 'nei', 'nai',
    'bola', 'bolen', 'bolo', 'bolun', 'bolle', 'ache', 'ase', 'achen', 'thake', 'thakle', 'thaka',
    'pora', 'porar', 'pore', 'porle', 'porbo', 'porte', 'khawa', 'khele', 'khete', 'khaile',
    'bose', 'boshe', 'utha', 'uthte', 'shona', 'shunle', 'dekha', 'dekhle', 'rakha', 'rakhle',
    'na', 'nai', 'noy', 'naki', 'ba', 'othoba', 'ebong', 'ar', 'kintu', 'tobe', 'jodi', 'tahole', 'taile',
    'jonno', 'jonyo', 'theke', 'sathe', 'songe', 'moddhe', 'vitor', 'vitore', 'upor', 'upore', 'niche',
    'ami', 'amar', 'amader', 'apni', 'apnar', 'tumi', 'tomar', 'se', 'tar', 'tader', 'amra',
    'ekta', 'ekti', 'kichu', 'kisu', 'sob', 'shob', 'onek', 'khub', 'beshi', 'kom', 'ektu',
    'valo', 'bhalo', 'kharap', 'uchit', 'dorkar', 'proyojon', 'niyom', 'bidhan', 'hukum', 'somporke', 'bishoye',
    'islam', 'islame', 'islamer', 'islamic', 'muslim', 'masala', 'fatwa', 'dalil', 'sahih',
    'please', 'plz', 'pls', 'tell', 'me', 'give', 'ruling', 'allowed', 'permissible', 'valid', 'break', 'breaks', 'broken', 'does', 'during', 'while',
  ]);

  const GENERIC_QUERY_WORDS = new Set(
    [
      'কি', 'কী', 'কেন', 'কখন', 'কোথায়', 'কিভাবে', 'কীভাবে', 'কেমন', 'কোন', 'কোনো', 'কোনটি',
      'কত', 'কয়', 'কয়টি', 'কার', 'কাকে', 'কে', 'কারা',
      'হয়', 'হবে', 'হলে', 'হলো', 'হল', 'হয়েছে', 'হচ্ছে', 'হতে', 'হওয়া',
      'যায়', 'যাবে', 'গেলে', 'যাওয়া', 'পারে', 'পারবে', 'পারা', 'পারি',
      'করা', 'করে', 'করলে', 'করব', 'করবো', 'করতে', 'করার', 'করেন',
      'দেওয়া', 'দেয়া', 'দিলে', 'দিতে', 'নেওয়া', 'নেয়া', 'নিলে', 'নিতে',
      'বলা', 'বলার', 'বলে', 'বললে', 'বলেন', 'আছে', 'নেই', 'নাই', 'থাকা', 'থাকে', 'থাকলে',
      'গিয়ে', 'গিয়ে', 'এসে', 'আসা', 'বসে', 'দাঁড়িয়ে', 'পড়া', 'পড়ার', 'পড়লে', 'রাখা', 'রাখার', 'দেওয়া', 'দেওয়ার', 'নেওয়া', 'নেওয়ার',
      'দিয়ে', 'নিয়ে', 'হয়ে', 'করেই', 'ভাবে', 'পawar', 'পাওয়া', 'পাওয়ার',
      'জন্য', 'থেকে', 'সাথে', 'সঙ্গে', 'মধ্যে', 'ভেতরে', 'উপর', 'ওপর', 'নিচে', 'নীচে',
      'এবং', 'ও', 'বা', 'অথবা', 'কিন্তু', 'তবে', 'যদি', 'তাহলে', 'নাকি', 'না', 'নয়',
      'এই', 'সেই', 'ওই', 'এটি', 'সেটি', 'এটা', 'সেটা', 'একটি', 'একটা', 'কিছু', 'সব', 'সকল',
      'আমার', 'আমাদের', 'আপনার', 'তাদের', 'তার', 'আমি', 'আমরা', 'তুমি', 'আপনি',
      'ইসলাম', 'ইসলামে', 'ইসলামের', 'ইসলামিক', 'ইসলামী', 'মুসলিম', 'মুসলমান', 'শারঈ', 'শরীয়ত', 'শরীআত',
      'প্রশ্ন', 'উত্তর', 'জবাব', 'জানতে', 'চাই', 'বলুন', 'জানান', 'বিষয়ে', 'সম্পর্কে', 'ব্যাপারে',
      'বিধান', 'হুকুম', 'মাসআলা', 'ফতোয়া', 'দলিল', 'দলিলসহ', 'আলোকে', 'অবস্থান', 'দৃষ্টিভঙ্গি',
      'আসসালামু', 'আলাইকুম', 'সালাম', 'রাহমাতুল্লাহ', 'রাহমাতুল্লাহি', 'বারাকাতুহু', 'ওয়া',
      'ভাই', 'ভাইয়া', 'বোন', 'আপু', 'হুজুর', 'শায়খ', 'শায়েখ', 'স্যার', 'বন্ধু',
      'দয়া', 'অনুগ্রহ', 'প্লিজ', 'একটু', 'আচ্ছা', 'হ্যালো', 'হাই', 'আজকে', 'এখন', 'সঠিক', 'উচিত', 'করণীয়',
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'do', 'does', 'can',
      'in', 'on', 'of', 'to', 'for', 'with', 'about', 'the', 'and', 'or', 'islam', 'islamic', 'muslim',
      'assalamu', 'alaikum', 'salam', 'bhai', 'bhaiya', 'hujur', 'sheikh', 'hello', 'hi', 'hey', 'please',
    ].map((w) => stemBn(foldBn(w)))
  );

  function isCoreToken(tok) {
    if (!tok || tok.length < 2 || /^\d+$/.test(tok)) return false;
    if (GENERIC_QUERY_WORDS.has(tok) || GENERIC_QUERY_WORDS.has(foldBn(tok)) || BANGLISH_STOP_WORDS.has(tok)) return false;
    return true;
  }

  // Replace known Banglish/English words (including inflected Banglish suffixes like -er, -r, -te, -ke, -der)
  // with Bengali equivalents while preserving unknown non-Banglish English words for strict OOD abstention!
  const BANGLISH_INFLECTION_SUFFIXES = ['gulo', 'gula', 'der', 'ter', 'tar', 'tir', 'er', 'te', 'ke', 'ta', 'ti', 'ra', 'r', 's', 'ing'];
  function resolveBanglishWord(w) {
    if (BANGLISH_AND_EN_MAP[w]) return BANGLISH_AND_EN_MAP[w];
    for (const suf of BANGLISH_INFLECTION_SUFFIXES) {
      if (w.length - suf.length >= 3 && w.endsWith(suf)) {
        const stem = w.slice(0, -suf.length);
        if (BANGLISH_AND_EN_MAP[stem]) return BANGLISH_AND_EN_MAP[stem];
      }
    }
    return null;
  }

  function translateBanglishAndEnglish(rawQuery) {
    return String(rawQuery || '').replace(/[a-zA-Z]{1,}/g, (rawWord) => {
      const w = rawWord.toLowerCase();
      const mapped = resolveBanglishWord(w);
      if (mapped) return ` ${mapped} `;
      if (w.length === 1 || BANGLISH_STOP_WORDS.has(w)) return ' ';
      for (const suf of ['er', 'te', 'ke', 'ta', 'ti', 'ra', 'r']) {
        if (w.length - suf.length >= 3 && w.endsWith(suf) && BANGLISH_STOP_WORDS.has(w.slice(0, -suf.length))) {
          return ' ';
        }
      }
      return rawWord;
    });
  }

  // =========================================================================
  // Natural Everyday Bengali / Banglish / English Dialogue & Multi-Turn Engine
  // =========================================================================
  const DAWAHX_REMINDERS = [
    {
      arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
      meaning: 'জেনে রেখো, আল্লাহর যিকিরেই অন্তরসমূহ প্রশান্ত হয়।',
      ref: 'সূরা আর-রাদ ১৩:২৮',
      reflection: 'জীবনের ব্যস্ততা বা অস্থিরতার মাঝে কয়েক মুহূর্ত নীরবে আল্লাহর স্মরণ ও ইস্তিগফার হৃদয়ে অদ্ভুত প্রশান্তি এনে দেয়।',
    },
    {
      arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
      meaning: 'নিশ্চয়ই কষ্টের সাথেই স্বস্তি রয়েছে; নিশ্চয়ই কষ্টের সাথেই স্বস্তি রয়েছে।',
      ref: 'সূরা আল-ইনশিরাহ ৯৪:৫-৬',
      reflection: 'কোনো কঠিন সময়ই স্থায়ী নয়—ধৈর্য ও তাওয়াক্কুলের সাথে এগিয়ে গেলে আল্লাহ নিজেই পথ খুলে দেন।',
    },
    {
      arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
      meaning: 'আল্লাহ কোনো ব্যক্তিকে তার সামর্থ্যের বাইরে দায়িত্ব চাপিয়ে দেন না।',
      ref: 'সূরা আল-বাকারাহ ২:২৮৬',
      reflection: 'আপনি এখন যে পরিস্থিতির মধ্য দিয়ে যাচ্ছেন, আল্লাহ জানেন তা অতিক্রম করার শক্তি আপনার আছে।',
    },
    {
      arabic: 'الدِّينُ النَّصِيحَةُ',
      meaning: 'দ্বীন হলো কল্যাণকামিতা ও আন্তরিক সদুপদেশ।',
      ref: 'সহীহ মুসলিম ৫৫',
      reflection: 'মানুষের সাথে সুন্দর আচরণ, হাসিমুখে কথা বলা এবং অন্যের কল্যাণ চাওয়াও ইবাদতের অংশ।',
    },
  ];

  const CHAT_PATTERNS = {
    salam: /^\s*(?:আসসালামু\s*আলাইকুম|আস-সালামু\s*আলাইকুম|সালামু?\s*আলাইকুম|সালাম|assalamu\s*alaikum|as-salamu\s*alaikum|salam|slm)(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?|\s+wa\s*rahmatullah(?:i\s*wa\s*barakatuhu?)?)?(?:\s*[।,!?\-]*\s*(?:ভাই|ভাইয়া|বোন|বন্ধু|তুমি\s*কেমন\s*আছো?|কেমন\s*আছো?(?:\s*তুমি)?|কেমন\s*আছেন(?:\s*আপনি)?|kemon\s*acho|kmn\s*acho))?[।!?.,\s]*$/i,
    hello: /^\s*(?:হ্যালো|হাই|হেই|ওহে|প্রিয়|সুপ্রভাত|শুভ\s*সকাল|শুভ\s*দুপুর|শুভ\s*বিকেল|শুভ\s*সন্ধ্যা|hello|hi+|hey+|hlw|good\s*morning|good\s*afternoon|good\s*evening)(?:\s*[।,!?\-]*\s*(?:ভাই|ভাইয়া|বন্ধু|কেমন\s*আছো?(?:\s*তুমি)?|কেমন\s*আছেন|there|bro|friend))?[।!?.,\s]*$/i,
    howAreYou: /^\s*(?:আচ্ছা\s*|এই\s*যে\s*)?(?:আপনি\s*|তুমি\s*|তোমরা\s*|ভাই\s*|ভাইয়া\s*)?(?:কেমন\s*আছো?|কেমন\s*আছেন|কেমন\s*আছিস|কী\s*অবস্থা|কি\s*অবস্থা|কী\s*খবর|কি\s*খবর|দিনকাল\s*কেমন\s*(?:যাচ্ছে|কাটছে)|সব\s*ঠিকঠাক|ভালো\s*আছো?\s*তো|ভালো\s*আছেন\s*তো|kemon\s*acho|kemon\s*achen|kmn\s*acho|kmn\s*aso|ki\s*khobor|ki\s*obostha|how\s*are\s*you(?:\s*doing)?|how'?s\s*it\s*going|what'?s\s*up)(?:\s*(?:তুমি|আপনি|ভাই|ভাইয়া|বন্ধু|বলো|তো|এখন|আজকে?|tumi|apni|bhai|bro))?[।!?.,\s]*$/i,
    userGood: /^\s*(?:আলহামদুলিল্লাহ\s*)?(?:আমিও?\s*)?(?:ভালো(?:\s*আছি)?|বেশ\s*ভালো(?:\s*আছি)?|অনেক\s*ভালো(?:\s*আছি)?|আলহামদুলিল্লাহ(?:\s*ভালো)?|চলে\s*যাচ্ছে|মোটামুটি(?:\s*ভালো)?|খুব\s*ভালো(?:\s*আছি)?|alhamdulillah(?:\s*valo|\s*bhalo|\s*good|\s*fine)?|ami\s*valo\s*achi|bhalo\s*achi|valo\s*asi|i'?m\s*(?:good|fine|doing\s*well)|doing\s*(?:good|great|well))[।!?.,\s]*$/i,
    userSad: /(?:মন(?:টা)?\s*(?:আজকে?\s*)?(?:খুব\s*|একটু\s*|অনেক\s*|বেশ\s*|বড্ড\s*)?খারাপ|(?:খুব|অনেক|বড্ড)\s*কষ্ট(?:ে\s*আছি|\s*পাচ্ছি|\s*লাগছে)|হতাশ\s*লাগছে|ডিপ্রেশনে\s*আছি|দুশ্চিন্তা\s*(?:লাগছে|হচ্ছে)|ভালো\s*লাগছে\s*না|অস্থির\s*লাগছে|একা\s*লাগছে|টেনশনে\s*আছি|অনেক\s*চাপে\s*আছি|mon(?:\s*ta)?\s*(?:ektu\s*|khub\s*)?kharap|valo\s*lagche\s*na|koste\s*achi|tension\s*lagche|feeling\s*(?:sad|down|depressed|lonely|anxious)|i\s*am\s*(?:sad|depressed|stressed|worried))/i,
    whatDoing: /^\s*(?:তুমি\s*|আপনি\s*)?(?:এখন\s*)?(?:ক[িী]\s*করছো?|ক[িী]\s*করছেন|ক[িী]\s*করো?|ব্যস্ত\s*নাকি|ফ্রি\s*আছো?|আছো?\s*নাকি|ki\s*korcho|ki\s*koro|ki\s*korchen|free\s*acho|what\s*are\s*you\s*doing)(?:\s*(?:তুমি|আপনি|এখন))?[।!?.,\s]*$/i,
    canWeChat: /^\s*(?:আমার\s*সাথে\s*|একটু\s*)?(?:কথা\s*বলবে|কথা\s*বলতে\s*পারো?|গল্প\s*করবে|আড্ডা\s*দেবে|নরমাল\s*কথা\s*বলো|স্বাভাবিক\s*কথা\s*বলো|তুমি\s*কি\s*কথা\s*বলতে\s*পারো|বাংলায়?\s*কথা\s*বলতে\s*পারো?|তুমি\s*কি\s*বাংলা\s*বোঝো|আমার\s*বন্ধু\s*হবে|তুমি\s*কি\s*আমার\s*বন্ধু|বোর\s*লাগছে|ক[িী]\s*নিয়ে\s*কথা\s*বলব|kotha\s*bolbe|golpo\s*korbe|can\s*we\s*(?:talk|chat)|talk\s*to\s*me|let'?s\s*chat|be\s*my\s*friend)[।!?.,\s]*$/i,
    thanks: /^\s*(?:অনেক\s*|অসংখ্য\s*)?(?:ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাংকস|শুকরিয়া|জাযাকাল্লাহ(?:ু\s*খাইরান)?|জাজাকাল্লাহ(?:ু\s*খাইরান)?|বারাকাল্লাহ(?:ু\s*ফিকুম)?|dhonnobad|shukriya|jazakallah(?:\s*khair(?:an)?)?|thanks?(?:\s*a\s*lot)?|thank\s*you(?:\s*so\s*much)?|ty|tnx)(?:\s*(?:ভাই|ভাইয়া|তোমাকে|আপনাকে))?[।!?.,\s]*$/i,
    praise: /^\s*(?:মাশাআল্লাহ|সুবহানাল্লাহ|আলহামদুলিল্লাহ\s*অনেক\s*সুন্দর|খুব\s*সুন্দর(?:\s*বলেছো|\s*হয়েছে)?|অসাধারণ|দারুণ|চমৎকার|অনেক\s*ভালো\s*লাগলো|অনেক\s*উপকার\s*হলো|খুব\s*ভালো\s*লেগেছে|তুমি\s*(?:অনেক|খুব)\s*ভালো|mashallah|masha\s*allah|subhanallah|khub\s*sundor|awesome|great(?:\s*answer)?|nice|wonderful)[।!?.,\s]*$/i,
    ack: /^\s*(?:আচ্ছা|ও\s*আচ্ছা|ওহ\s*আচ্ছা|হুম+|ঠিক\s*আছে|বুঝলাম|বুঝতে\s*পেরেছি|জি\s*বুঝেছি|হ্যাঁ|জি|ওকে|সহমত|ইনশাআল্লাহ|আমিন|সুম্মা\s*আমিন|আস্তাগফিরুল্লাহ|আল্লাহু\s*আকবার|accha|oh\s*accha|hmm+|ok+|okay|bujhlam|bujhte\s*perechi|thik\s*ache|inshallah|ameen)[।!?.,\s]*$/i,
    farewell: /^\s*(?:আল্লাহ\s*হাফেজ|খোদা\s*হাফেজ|ফি\s*আমানিল্লাহ|বিদায়|আসি\s*তাহলে|পরে\s*কথা\s*হবে|ভালো\s*থেকো|ভালো\s*থাকবেন|শুভ\s*রাত্রি|allah\s*hafez|fi\s*amanillah|bye+|good\s*bye|good\s*night|tata|see\s*you)[।!?.,\s]*$/i,
    duaReq: /^\s*(?:আমার\s*জন্য\s*|আমাদের\s*জন্য\s*)?(?:দোয়া\s*করো?|দোয়া\s*করবেন|দোয়া\s*রেখো|doa\s*koro|dua\s*korben|pray\s*for\s*me)[।!?.,\s]*$/i,
    identity: /^\s*(?:তুমি\s*কে|আপনি\s*কে|তোমার\s*পরিচয়\s*ক[িী]|তোমার\s*নাম\s*ক[িী]|আপনার\s*নাম\s*ক[িী]|কে\s*তৈরি\s*করেছে|তোমাকে\s*কে\s*বানিয়েছে|ক[িী]ভাবে\s*কাজ\s*করো?|তুমি\s*ক[িী]\s*(?:ক[িী]\s*)?করতে\s*পারো?|তুমি\s*কি\s*এআই|তুমি\s*কি\s*চ্যাটজিপিটি|tumi\s*ke|tomar\s*nam\s*ki|ke\s*baniyeche|who\s*are\s*you|what\s*is\s*your\s*name|who\s*created\s*you|how\s*do\s*you\s*work)[।!?.,\s]*$/i,
    timeDate: /^\s*(?:এখন\s*|আজকে?\s*)?(?:কয়টা\s*বাজে|সময়\s*কত|আজকে?\s*ক[িী]\s*বার|ক[িী]\s*বার\s*আজকে?|আজকের?\s*তারিখ\s*কত|আজ\s*কত\s*তারিখ|কয়\s*তারিখ\s*আজকে?|koyta\s*baje|ajke\s*ki\s*bar|aj\s*koto\s*tarikh|what\s*time\s*is\s*it|what\s*day\s*is\s*today|today'?s?\s*date)(?:\s*(?:এখন|আজকে?|বলো(?:\s*তো)?|now))?[।!?.,\s]*$/i,
    eatSleep: /^\s*(?:তুমি\s*ক[িী]\s*)?(?:ভাত\s*(?:খেয়েছো?|খাইছো?|খান)|চা\s*(?:খেয়েছো?|খাইছো?)|নাস্তা\s*(?:করেছো?|করছো?)|খাবার\s*খেয়েছো?|ক[িী]\s*খেয়েছো?|ঘুমাও\s*না|তুমি\s*ক[িী]\s*ঘুমাও|তুমি\s*ক[িী]\s*খাও|bhat\s*khaicho|vat\s*khaicho|nasta\s*korcho|khawa\s*dawa\s*korcho|have\s*you\s*eaten)(?:\s*(?:তুমি|ভাই))?[।!?.,\s]*$/i,
    whereLive: /^\s*(?:তুমি\s*কোথায়\s*থাকো|আপনি\s*কোথায়\s*থাকেন|তোমার\s*বাসা\s*কোথায়|তোমার\s*বাড়ি\s*কোথায়|তোমার\s*বয়স\s*কত|তুমি\s*ক[িী]\s*মানুষ\s*(?:না|নাকি)\s*(?:রোবট|এআই)|তুমি\s*ক[িী]\s*রোবট|kothay\s*thako|tomar\s*bari\s*kothay|where\s*do\s*you\s*live|how\s*old\s*are\s*you|are\s*you\s*human)[।!?.,\s]*$/i,
    myName: /^\s*(?:আমার\s*নাম\s*(?:হলো\s*|হচ্ছে\s*)?|আমি\s*হলাম\s*|my\s*name\s*is\s+|i\s*am\s+)([^\d?!।.,;:\n]{2,28})[।!?.,\s]*$/i,
    story: /^\s*(?:একটা\s*(?:গল্প|ঘটনা|শিক্ষণীয়\s*গল্প|ইসলামিক\s*গল্প|মজার\s*কিছু|জোকস)\s*(?:বলো|বলেন|শোনাও)|গল্প\s*বলো|জোকস\s*বলো|মজার\s*কিছু\s*বলো|tell\s*me\s*a\s*story|ekta\s*golpo\s*bolo)[।!?.,\s]*$/i,
    inspire: /^\s*(?:আমাকে\s*)?(?:একটা\s*|কিছু\s*)?(?:সুন্দর\s*|ভালো\s*|ইসলামিক\s*)?(?:উপদেশ\s*দাও|নসিহত\s*(?:করো|দাও)|হাদ[িী]স\s*(?:বলো|শোনাও)|আয়াত\s*(?:বলো|শোনাও)|অনুপ্রেরণা\s*দাও|মন\s*ভালো\s*করার\s*(?:মতো\s*)?(?:একটা\s*)?(?:সুন্দর\s*)?(?:হাদ[িী]স\s*(?:বা\s*উপদেশ\s*)?(?:শোনাও|বলো)|কিছু\s*বলো)|give\s*me\s*(?:some\s*)?advice|tell\s*me\s*a\s*hadith)[।!?.,\s]*$/i,
    elaborate: /^\s*(?:আরেকটু\s*|আরও\s*|একটু\s*)?(?:বিস্তারিত\s*(?:বলো|বলুন|বোঝাও)|সহজ\s*করে\s*(?:বলো|বোঝাও|বুঝিয়ে\s*বলো)|পুরোটা\s*(?:বলো|বলুন)|ব্যাখ্যা\s*(?:করো|দাও)|আরও\s*জানতে\s*চাই|আরেকটু\s*বলো|aro\s*bistarito\s*bolo|sohoj\s*kore\s*bolo|explain\s*more|tell\s*me\s*more)[।!?.,\s]*$/i,
    askDalil: /^\s*(?:এর\s*|এটার\s*|এই\s*বিষয়ের\s*)?(?:দলিল\s*ক[িী]|দলিল\s*দাও|দলিলগুলো\s*দেখাও|হাদ[িী]সটা\s*বলো|কোন\s*সূরায়\s*আছে|রেফারেন্স\s*দাও|dalil\s*ki|reference\s*dao|what\s*is\s*the\s*evidence)[।!?.,\s]*$/i,
    askVideo: /^\s*(?:এ\s*বিষয়ে\s*|এটার\s*)?(?:কোনো\s*)?(?:ভিডিও\s*আছে|ভিডিও\s*দাও|ভিডিও\s*আলোচনা\s*দেখুন|লেকচার\s*আছে|video\s*ache|any\s*video)[।!?.,\s]*$/i,
    ellipsisFollowup: /^\s*(?:আর\s+|তাহলে\s+|কিন্তু\s+|যদি\s+|এতে\s*কি\s+|সেক্ষেত্রে\s+|ওটা\s+|এটা\s+|এই\s*অবস্থায়\s+|নাকি\s+)/i,
    leadingSalam: /^\s*(?:আসসালামু\s*আলাইকুম|আস-সালামু\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam)(?=\s|[।,!?:;\-]|$)/i,
  };

  function toBnDigitsStr(val) {
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(val).replace(/\d/g, (d) => bn[Number(d)]);
  }

  // =========================================================================
  // Live Astronomical Prayer, Sehri & Iftar Engine (All 8 Divisions / 26 Cities of Bangladesh)
  // =========================================================================
  const BD_CITIES = [
    { id: 'dhaka', bn: 'ঢাকা', lat: 23.7104, lon: 90.4074, aliases: ['ঢাকা', 'dhaka', 'ঢাকায়'] },
    { id: 'chattogram', bn: 'চট্টগ্রাম', lat: 22.3569, lon: 91.7832, aliases: ['চট্টগ্রাম', 'চট্টগ্রামে', 'চিটাগং', 'chittagong', 'chattogram', 'ctg'] },
    { id: 'sylhet', bn: 'সিলেট', lat: 24.8949, lon: 91.8687, aliases: ['সিলেট', 'সিলেটে', 'sylhet'] },
    { id: 'rajshahi', bn: 'রাজশাহী', lat: 24.3745, lon: 88.6042, aliases: ['রাজশাহী', 'রাজশাহীতে', 'rajshahi'] },
    { id: 'khulna', bn: 'খুলনা', lat: 22.8456, lon: 89.5403, aliases: ['খুলনা', 'খুলনায়', 'khulna'] },
    { id: 'barishal', bn: 'বরিশাল', lat: 22.7010, lon: 90.3535, aliases: ['বরিশাল', 'বরিশালে', 'barishal', 'barisal'] },
    { id: 'rangpur', bn: 'রংপুর', lat: 25.7439, lon: 89.2752, aliases: ['রংপুর', 'রংপুরে', 'rangpur'] },
    { id: 'mymensingh', bn: 'ময়মনসিংহ', lat: 24.7471, lon: 90.4203, aliases: ['ময়মনসিংহ', 'ময়মনসিংহে', 'mymensingh'] },
    { id: 'cumilla', bn: 'কুমিল্লা', lat: 23.4607, lon: 91.1809, aliases: ['কুমিল্লা', 'কুমিল্লায়', 'comilla', 'cumilla'] },
    { id: 'coxsbazar', bn: 'কক্সবাজার', lat: 21.4272, lon: 92.0058, aliases: ['কক্সবাজার', 'কক্সবাজারে', 'coxsbazar', 'cox'] },
    { id: 'bogura', bn: 'বগুড়া', lat: 24.8465, lon: 89.3773, aliases: ['বগুড়া', 'বগুড়ায়', 'bogra', 'bogura'] },
    { id: 'gazipur', bn: 'গাজীপুর', lat: 23.9999, lon: 90.4203, aliases: ['গাজীপুর', 'গাজীপুরে', 'gazipur'] },
    { id: 'narayanganj', bn: 'নারায়ণগঞ্জ', lat: 23.6238, lon: 90.5000, aliases: ['নারায়ণগঞ্জ', 'নারায়ণগঞ্জে', 'narayanganj'] },
    { id: 'jashore', bn: 'যশোর', lat: 23.1664, lon: 89.2081, aliases: ['যশোর', 'যশোরে', 'jessore', 'jashore'] },
    { id: 'dinajpur', bn: 'দিনাজপুর', lat: 25.6217, lon: 88.6354, aliases: ['দিনাজপুর', 'দিনাজপুরে', 'dinajpur'] },
    { id: 'noakhali', bn: 'নোয়াখালী', lat: 22.8696, lon: 91.0995, aliases: ['নোয়াখালী', 'নোয়াখালীতে', 'noakhali'] },
    { id: 'feni', bn: 'ফেনী', lat: 23.0159, lon: 91.3976, aliases: ['ফেনী', 'ফেনীতে', 'feni'] },
    { id: 'pabna', bn: 'পাবনা', lat: 24.0064, lon: 89.2372, aliases: ['পাবনা', 'পাবনায়', 'pabna'] },
    { id: 'tangail', bn: 'টাঙ্গাইল', lat: 24.2513, lon: 89.9167, aliases: ['টাঙ্গাইল', 'টাঙ্গাইলে', 'tangail'] },
    { id: 'kushtia', bn: 'কুষ্টিয়া', lat: 23.9013, lon: 89.1204, aliases: ['কুষ্টিয়া', 'কুষ্টিয়ায়', 'kushtia'] },
    { id: 'faridpur', bn: 'ফরিদপুর', lat: 23.6070, lon: 89.8429, aliases: ['ফরিদপুর', 'ফরিদপুরে', 'faridpur'] },
    { id: 'brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া', lat: 23.9571, lon: 91.1119, aliases: ['ব্রাহ্মণবাড়িয়া', 'brahmanbaria'] },
    { id: 'moulvibazar', bn: 'মৌলভীবাজার', lat: 24.4829, lon: 91.7774, aliases: ['মৌলভীবাজার', 'শ্রীমঙ্গল', 'moulvibazar'] },
    { id: 'satkhira', bn: 'সাতক্ষীরা', lat: 22.7185, lon: 89.0705, aliases: ['সাতক্ষীরা', 'satkhira'] },
  ];

  function detectCityInText(text, fallbackCityId = 'dhaka') {
    const low = foldBn(String(text || ''));
    for (const c of BD_CITIES) {
      for (const al of c.aliases) {
        if (low.includes(foldBn(al))) return c;
      }
    }
    return BD_CITIES.find((c) => c.id === fallbackCityId) || BD_CITIES[0];
  }

  function formatHourBn(decHours) {
    const tot = ((Math.round(decHours * 60) % 1440) + 1440) % 1440;
    const h24 = Math.floor(tot / 60);
    const mm = String(tot % 60).padStart(2, '0');
    const h12 = h24 % 12 || 12;
    let period = 'রাত';
    if (h24 >= 4 && h24 < 6) period = 'ভোর';
    else if (h24 >= 6 && h24 < 12) period = 'সকাল';
    else if (h24 >= 12 && h24 < 15) period = 'দুপুর';
    else if (h24 >= 15 && h24 < 18) period = 'বিকেল';
    else if (h24 >= 18 && h24 < 20) period = 'সন্ধ্যা';
    return { h24, mm: Number(mm), totalMin: tot, label: `${period} ${toBnDigitsStr(h12)}:${toBnDigitsStr(mm)}`, short: `${toBnDigitsStr(h12)}:${toBnDigitsStr(mm)}` };
  }

  // Karachi 18°/18° astronomical calculation matching DAWAH X's prayer-times.js
  function computePrayerSchedule(cityInput = 'dhaka', dateObj = new Date()) {
    const city = typeof cityInput === 'string' ? detectCityInText(cityInput, cityInput) : cityInput;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      })
        .formatToParts(dateObj)
        .map((p) => [p.type, Number(p.value)])
    );
    const Y = parts.year;
    const M = parts.month;
    const D = parts.day;
    const nowMin = ((parts.hour % 24) * 60) + parts.minute;

    const a = Math.floor((14 - M) / 12);
    const y = Y + 4800 - a;
    const m = M + 12 * a - 3;
    const JDN = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    const d = (JDN - 0.25) - 2451545.0;
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;
    const g = ((357.529 + 0.98560028 * d) % 360 + 360) % 360;
    const q = ((280.459 + 0.98564736 * d) % 360 + 360) % 360;
    const L = ((q + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad)) % 360 + 360) % 360;
    const e = 23.439 - 0.00000036 * d;
    const RA = Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) * deg / 15;
    const decl = Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) * deg;
    let eqt = q / 15 - ((RA + 24) % 24);
    if (eqt > 12) eqt -= 24;
    if (eqt < -12) eqt += 24;

    const dhuhr = 12 + 6 - city.lon / 15 - eqt;
    const ha = (alt) =>
      Math.acos(
        (Math.sin(alt * rad) - Math.sin(city.lat * rad) * Math.sin(decl * rad)) /
          (Math.cos(city.lat * rad) * Math.cos(decl * rad))
      ) *
      (deg / 15);
    const asrHa = (shadow) => {
      const alt = Math.atan(1 / (shadow + Math.tan(Math.abs(city.lat - decl) * rad))) * deg;
      return ha(alt);
    };

    const raw = {
      sehriEnd: formatHourBn(dhuhr - ha(-18) - 2 / 60),
      fajr: formatHourBn(dhuhr - ha(-18)),
      sunrise: formatHourBn(dhuhr - ha(-0.833)),
      dhuhr: formatHourBn(dhuhr + 1 / 60),
      asr: formatHourBn(dhuhr + asrHa(1)),
      asrHanafi: formatHourBn(dhuhr + asrHa(2)),
      maghrib: formatHourBn(dhuhr + ha(-0.833)),
      isha: formatHourBn(dhuhr + ha(-18)),
    };

    const order = [
      { key: 'fajr', name: 'ফজর', t: raw.fajr },
      { key: 'sunrise', name: 'সূর্যোদয়', t: raw.sunrise },
      { key: 'dhuhr', name: 'যোহর', t: raw.dhuhr },
      { key: 'asr', name: 'আসর', t: raw.asr },
      { key: 'maghrib', name: 'মাগরিব / ইফতার', t: raw.maghrib },
      { key: 'isha', name: 'এশা', t: raw.isha },
    ];

    let currentWaqt = 'এশা / তাহাজ্জুদ';
    let nextWaqt = order[0];
    for (let i = 0; i < order.length; i++) {
      if (nowMin >= order[i].t.totalMin) {
        currentWaqt = order[i].key === 'sunrise' ? 'ইশরাক / চাশত (নফল সময়)' : order[i].name;
        nextWaqt = order[i + 1] || { key: 'fajr', name: 'আগামীকাল ফজর', t: raw.fajr };
      }
    }
    let diffMin = nextWaqt.t.totalMin - nowMin;
    if (diffMin < 0) diffMin += 1440;
    const remH = Math.floor(diffMin / 60);
    const remM = diffMin % 60;
    const countdown = remH > 0 ? `${toBnDigitsStr(remH)} ঘণ্টা ${toBnDigitsStr(remM)} মিনিট` : `${toBnDigitsStr(remM)} মিনিট`;

    return {
      city: city.bn,
      city_id: city.id,
      times: raw,
      current_waqt: currentWaqt,
      next_waqt_name: nextWaqt.name,
      next_waqt_time: nextWaqt.t.label,
      countdown_bn: countdown,
    };
  }

  // Detect live prayer / sehri / iftar schedule queries (without intercepting fiqh ruling questions!)
  const PRAYER_TIME_QUERY_RE = /(?:নামাজের\s*সময়(?:সূচ[িী])?|সালাতের\s*সময়(?:সূচ[িী])?|আজকের?\s*(?:নামাজের|সালাতের|ওয়াক্ত)|(?:ফজর|ফজরের|যোহর|যোহরের|আসর|আসরের|মাগরিব|মাগরিবের|এশা|এশার)\s*(?:ওয়াক্ত|আযান|আজান|সময়|কয়টায়|কখন)|(?:ওয়াক্ত|আযান)\s*(?:কখন|কয়টায়)|ইফতার\s*(?:কয়টায়|কখন|এর\s*সময়)|সেহরি(?:র)?\s*(?:শেষ\s*সময়|কখন|কয়টায়)|সাহরী(?:র)?\s*(?:শেষ\s*সময়|কখন)|এখন\s*কোন\s*ওয়াক্ত|prayer\s*times?|namaz\s*time|iftar\s*time|sehri\s*time|fajr\s*time|maghrib\s*time)/i;
  const FIQH_RULING_MARKER_RE = /(?:কাযা|ক্বাযা|কাজা|ছুটে\s*গেলে|ভুলে|রাকআত|রাকাত|ফরয\s*কয়|সুন্নাত|নফল|সিজদা|ওযু|গোসল|ভঙ্গ|ভাঙে|জায়েয|হারাম|বিধান|মাসআলা|নিয়ম|হাদীস|দলিল)/i;

  // Smart Zakat & Nisab Calculator
  function tryZakatCalculation(question) {
    const q = String(question || '').trim();
    const f = foldBn(q);
    if (!f.includes('জাকাত') && !q.toLowerCase().includes('zakat') && !q.toLowerCase().includes('jakat')) return null;
    if (!/(?:কত|হিসাব|হিসেব|ক্যালকুলেট|শতাংশ|পার্সেন্ট|টাকায়|টাকার|লাখ|লক্ষ|হাজার|কোটি|\d|[০-৯]|how\s*much|calculate)/i.test(q)) return null;
    // Do not intercept pure fiqh distribution questions like "সম্মেলনে যাকাতের টাকা দেওয়া যাবে কি?" unless an amount is given
    const enQ = bnToEnDigits(q).replace(/,/g, '');
    const numMatch = enQ.match(/(\d+(?:\.\d+)?)\s*(কোটি|crore|লক্ষ|লাখ|lakh|lac|হাজার|thousand)?/i);
    if (!numMatch && /(?:দেওয়া\s*যাবে|দেয়া\s*যাবে|সম্মেলন|মাদ্রাসা|মসজিদ|আত্মীয়|ভাই|বোন)/u.test(q)) {
      return null;
    }

    if (numMatch) {
      let base = parseFloat(numMatch[1]);
      const unit = (numMatch[2] || '').toLowerCase();
      if (/কোটি|crore/.test(unit)) base *= 10000000;
      else if (/লক্ষ|লাখ|lakh|lac/.test(unit)) base *= 100000;
      else if (/হাজার|thousand/.test(unit)) base *= 1000;

      if (base >= 500) {
        const zakatAmt = Math.round(base * 0.025 * 100) / 100;
        const fmtBnMoney = (n) => toBnDigitsStr(n.toLocaleString('en-IN'));
        return {
          amount_bdt: base,
          zakat_bdt: zakatAmt,
          direct_answer: `হিসাব অনুযায়ী আপনার যদি **${fmtBnMoney(base)} টাকা** যাকাতযোগ্য সঞ্চয়/সম্পদ নিসাব পরিমাণ অতিক্রম করে পূর্ণ ১ চান্দ্র বছর (হাওল) স্থায়ী থাকে, তবে এর শতকরা **২.৫% (চল্লিশ ভাগের এক ভাগ)** হিসেবে প্রদেয় যাকাতের পরিমাণ হবে: **${fmtBnMoney(zakatAmt)} টাকা**।`,
          explanation_paragraphs: [
            '**নিসাব ও শর্তাবলি (কুরআন ও সহীহ সুন্নাহর আলোকে):** স্বর্ণের নিসাব হলো **সাড়ে ৭ ভরি (প্রায় ৮৫ গ্রাম খাঁটি স্বর্ণ)** এবং রৌপ্যের নিসাব হলো **সাড়ে ৫২ ভরি (প্রায় ৫৯৫ গ্রাম রৌপ্য)** বা এর সমমূল্যের নগদ অর্থ, ব্যাংক ব্যালেন্স ও ব্যবসায়িক পণ্য। মৌলিক প্রয়োজন ও তাৎক্ষণিক ঋণ বাদ দিয়ে নিসাব পরিমাণ সম্পদ পূর্ণ এক হিজরি বছর থাকলে তার ওপর ২.৫% যাকাত ফরয হয়।',
          ],
        };
      }
    }
    return null;
  }

  // Authentic Masnoon Duas & Quranic Ayahs (on direct request)
  const MASNOON_DUAS = [
    {
      re: /(?:আয়াতুল\s*কুরস[িী]|ayatul\s*kursi)/i,
      title: 'আয়াতুল কুরসী (সূরা আল-বাকারাহ ২:২৫৫)',
      arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
      meaning: 'আল্লাহ—তিনি ছাড়া কোনো সত্য ইলাহ নেই। তিনি চিরঞ্জীব, সর্বসত্তার ধারক। তাঁকে তন্দ্রা ও নিদ্রা স্পর্শ করে না। আসমানসমূহ ও জমিনে যা কিছু আছে সব তাঁরই... তিনি সুউচ্চ, সুমহান।',
      virtue: 'ফযীলত: রাসূলুল্লাহ ﷺ বলেছেন, প্রত্যেক ফরয সালাতের পর আয়াতুল কুরসী পাঠকারীর জান্নাতে প্রবেশের পথে মৃত্যু ছাড়া আর কোনো বাধা থাকে না (সুনান নাসাঈ কুবরা ৯৯২৮, সহীহ)। ঘুমানোর আগে পড়লে সকাল পর্যন্ত আল্লাহর পক্ষ থেকে একজন প্রহরী নিযুক্ত থাকে (সহীহ বুখারী ২৩১১)।',
    },
    {
      re: /(?:সাইয়্যিদুল\s*ইস্তিগফার|সাইয়িদুল\s*ইস্তেগফার|শ্রেষ্ঠ\s*ইস্তিগফার|sayyidul\s*istighfar)/i,
      title: 'সাইয়্যিদুল ইস্তিগফার (ক্ষমা প্রার্থনার শ্রেষ্ঠ দোয়া)',
      arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
      meaning: 'হে আল্লাহ! আপনিই আমার রব, আপনি ছাড়া কোনো সত্য ইলাহ নেই। আপনিই আমাকে সৃষ্টি করেছেন এবং আমি আপনার বান্দা। আমি সাধ্যমতো আপনার অঙ্গীকার ও প্রতিশ্রুতির ওপর আছি। আমি আমার কৃতকর্মের অনিষ্ট থেকে আপনার আশ্রয় চাই। আমার ওপর আপনার নিআমত স্বীকার করছি এবং আমার গুনাহও স্বীকার করছি। অতএব আমাকে ক্ষমা করুন; কেননা আপনি ছাড়া গুনাহ ক্ষমা করার আর কেউ নেই।',
      virtue: 'ফযীলত: নবীজি ﷺ বলেছেন, কেউ দৃঢ় বিশ্বাসের সাথে সকালে এটি পাঠ করে সন্ধ্যার আগে মারা গেলে বা সন্ধ্যায় পাঠ করে সকালের আগে মারা গেলে সে জান্নাতবাসী হবে (সহীহ বুখারী ৬৩০৬)।',
    },
    {
      re: /^\s*(?:ঘুমানোর\s*(?:আগের?|সময়ের?)\s*(?:দোয়া|দুআ)|ঘুমাতে\s*যাওয়ার\s*দোয়া|sleeping\s*dua|dua\s*before\s*sleep)(?:\s*(?:ক[িী]|বলো|বলুন|দাও|জানাও))?[।!?.,\s]*$/i,
      title: 'ঘুমানোর আগের সুন্নাত দোয়া ও ঘুম থেকে ওঠার দোয়া',
      arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
      meaning: 'উচ্চারণ: বিসমিকা আল্লাহুম্মা আমূতু ওয়া আহইয়া।\nঅর্থ: হে আল্লাহ! আপনারই নামে আমি মৃত্যুবরণ করি (ঘুমাই) এবং আপনারই নামে জীবিত হই (জেগে উঠি)।',
      virtue: 'ঘুম থেকে জেগে ওঠার দোয়া: الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ — “সকল প্রশংসা আল্লাহর জন্য, যিনি আমাদেরকে মৃত্যু (নিদ্রা) দেওয়ার পর আবার জীবিত করেছেন এবং তাঁরই কাছে আমাদের পুনরুত্থান” (সহীহ বুখারী ৬৩১২)। এ ছাড়া ঘুমানোর আগে আয়াতুল কুরসী এবং সূরা ইখলাস, ফালাক ও নাস পড়ে শরীরে ফুঁ দেওয়া সুন্নাত।',
    },
    {
      re: /^\s*(?:খাওয়ার\s*(?:শুরু(?:\s*ও\s*শেষের)?|আগের?|শেষের?|পরের?)\s*(?:দোয়া|দুআ)|খানা\s*খাওয়ার\s*দোয়া|eating\s*dua|dua\s*(?:before|after)\s*eating)(?:\s*(?:ক[িী]|বলো|বলুন|দাও|জানাও))?[।!?.,\s]*$/i,
      title: 'খাওয়ার শুরু ও শেষের সহীহ মাসনূন দোয়া',
      arabic: 'بِسْمِ اللَّهِ  |  الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
      meaning: '• খাওয়ার শুরুতে: “বিসমিল্লাহ” (শুরুতে ভুলে গেলে মনে পড়ামাত্র বলবে: “বিসমিল্লাহি ফী আউয়ালিহী ওয়া আখিরিহী” — সুনান আবূ দাউদ ৩৭৬৭)।\n• খাওয়ার শেষে: “আলহামদুলিল্লাহিল্লাযী আত‘আমানী হাযা ওয়া রাযাকানীহি মিন গাইরি হাওলিন মিন্নী ওয়ালা কুওয়্যাহ” — সকল প্রশংসা আল্লাহর, যিনি আমার নিজস্ব কোনো প্রচেষ্টা ও শক্তি ছাড়াই আমাকে এ খাবার খাইয়েছেন এবং রিযিক দান করেছেন।',
      virtue: 'ফযীলত: খাওয়ার শেষে এই দোয়া পাঠ করলে তার পূর্ববর্তী সগীরা গুনাহসমূহ ক্ষমা করে দেওয়া হয় (সুনান তিরমিযী ৩৪৫৮ — হাসান)।',
    },
    {
      re: /^\s*(?:পিতা[-\s]*মাতার\s*জন্য\s*(?:দোয়া|দুআ)|মা[-\s]*বাবার\s*জন্য\s*(?:দোয়া|দুআ)|dua\s*for\s*parents)(?:\s*(?:ক[িী]|বলো|বলুন|দাও))?[।!?.,\s]*$/i,
      title: 'পিতা-মাতার জন্য কুরআনে বর্ণিত শ্রেষ্ঠ দোয়া',
      arabic: 'رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
      meaning: 'উচ্চারণ: রাব্বির হামহুমা কামা রাব্বাইয়ানী সাগীরা।\nঅর্থ: হে আমার রব! তাদের উভয়ের প্রতি দয়া করুন, যেভাবে তারা শৈশবে আমাকে লালন-পালন করেছেন।',
      virtue: 'সূত্র: সূরা আল-ইসরা (বনী ইসরাঈল) ১৭:২৪; আরও পড়ুন: رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ (সূরা ইবরাহীম ১৪:৪১)।',
    },
    {
      re: /^\s*(?:জ্ঞান\s*(?:বৃদ্ধির|বাড়ানোর)\s*(?:দোয়া|দুআ)|ইলম\s*বৃদ্ধির\s*দোয়া|পড়াশোনার\s*দোয়া|dua\s*for\s*knowledge)(?:\s*(?:ক[িী]|বলো|বলুন|দাও))?[।!?.,\s]*$/i,
      title: 'জ্ঞান ও উপকারী ইলম বৃদ্ধির দোয়া',
      arabic: 'رَّبِّ زِدْنِي عِلْمًا  |  اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
      meaning: '১) “রাব্বি যিদনী ইলমা” — হে আমার রব! আমার জ্ঞান বৃদ্ধি করে দিন (সূরা ত্ব-হা ২০:১১৪)।\n২) “আল্লাহুম্মা ইন্নী আসআলুকা ইলমান নাফি‘আন, ওয়া রিযকান তায়্যিবান, ওয়া আমালান মুতাকাব্বালান” — হে আল্লাহ! আমি আপনার কাছে উপকারী জ্ঞান, পবিত্র রিযিক এবং কবুলযোগ্য আমল প্রার্থনা করছি (সুনান ইবনু মাজাহ ৯২৫ — সহীহ)।',
      virtue: 'ফযরের সালাতের সালাম ফেরানোর পর এই দোয়াটি পাঠ করা রাসূলুল্লাহ ﷺ-এর নিয়মিত সুন্নাত ছিল।',
    },
  ];

  // Interactive Authentic Islamic Quiz Bank
  const ISLAMIC_QUIZZES = [
    {
      id: 0,
      q: 'পবিত্র কুরআনের সবচেয়ে মর্যাদাপূর্ণ আয়াত কোনটি?',
      options: ['ক) সূরা ফাতিহার প্রথম আয়াত', 'খ) আয়াতুল কুরসী (সূরা বাকারাহ ২৫৫)', 'গ) সূরা ইখলাসের প্রথম আয়াত', 'ঘ) সূরা হাশরের শেষ আয়াত'],
      ansIdx: 1,
      matchRe: /(?:^|\s)(?:খ|b|2|২|আয়াতুল\s*কুরস|কুরসী|kursi)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **খ) আয়াতুল কুরসী (সূরা আল-বাকারাহ ২:২৫৫)**! সহীহ মুসলিমে (হা/৮১০) উবাই ইবনু কা‘ব (রাঃ)-এর হাদীসে রাসূলুল্লাহ ﷺ আয়াতুল কুরসীকে আল্লাহর কিতাবের সর্বশ্রেষ্ঠ আয়াত হিসেবে স্বীকৃতি দিয়েছেন।',
    },
    {
      id: 1,
      q: 'কুরআন মাজীদে মোট কতজন নবী ও রাসূলের নাম সরাসরি উল্লেখ করা হয়েছে?',
      options: ['ক) ১৫ জন', 'খ) ২৫ জন', 'গ) ৪০ জন', 'ঘ) ৭০ জন'],
      ansIdx: 1,
      matchRe: /(?:^|\s)(?:খ|b|25|২৫)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **খ) ২৫ জন**! আল-কুরআনে মোট ২৫ জন নবী-রাসূলের নাম প্রত্যক্ষভাবে এসেছে (যাঁদের মধ্যে ১৮ জনের নাম সূরা আল-আনআমের ৮৩-৮৬ আয়াতে একত্রে এসেছে)।',
    },
    {
      id: 2,
      q: 'রাসূলুল্লাহ ﷺ-এর ওপর সর্বপ্রথম কোন সূরার প্রথম ৫টি আয়াত নাযিল হয়েছিল?',
      options: ['ক) সূরা আল-ফাতিহা', 'খ) সূরা আল-মুদ্দাসসির', 'গ) সূরা আল-আলাক', 'ঘ) সূরা আল-বাকারাহ'],
      ansIdx: 2,
      matchRe: /(?:^|\s)(?:গ|c|3|৩|আলাক|alaq)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **গ) সূরা আল-আলাক** (اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ — “পড়ো তোমার রবের নামে, যিনি সৃষ্টি করেছেন”)! হেরা গুহায় এটিই ছিল প্রথম ওহী (সহীহ বুখারী ৩)।',
    },
    {
      id: 3,
      q: 'কিয়ামতের দিন বান্দার আমলসমূহের মধ্যে সর্বপ্রথম কোন আমলের হিসাব নেওয়া হবে?',
      options: ['ক) রোজা', 'খ) যাকাত', 'গ) হজ্জ', 'ঘ) সালাত (নামাজ)'],
      ansIdx: 3,
      matchRe: /(?:^|\s)(?:ঘ|d|4|৪|সালাত|নামাজ|নামায|salat|namaz)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **ঘ) সালাত (নামাজ)**! রাসূলুল্লাহ ﷺ বলেছেন: “কিয়ামতের দিন বান্দার সর্বপ্রথম যে আমলের হিসাব নেওয়া হবে তা হলো সালাত” (সুনান তিরমিযী ৪১৩, নাসাঈ ৪৬৫ — সহীহ)।',
    },
    {
      id: 4,
      q: 'পবিত্র কুরআনের কোন সূরাকে কুরআনের এক-তৃতীয়াংশের সমতুল্য বলা হয়েছে?',
      options: ['ক) সূরা আল-মুলক', 'খ) সূরা আল-ইখলাস', 'গ) সূরা আল-কাহফ', 'ঘ) সূরা আর-রাহমান'],
      ansIdx: 1,
      matchRe: /(?:^|\s)(?:খ|b|2|২|ইখলাস|ইখলাছ|ikhlas)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **খ) সূরা আল-ইখলাস**! সহীহ বুখারী (৫০১৫) ও সহীহ মুসলিমে বর্ণিত হয়েছে যে, সূরা আল-ইখলাস কুরআনের এক-তৃতীয়াংশের সমান মর্যাদাসম্পন্ন।',
    },
    {
      id: 5,
      q: 'জুমআর দিনে কোন সূরা তিলাওয়াত করলে দুই জুমআর মধ্যবর্তী সময় নূর দ্বারা আলোকিত থাকে?',
      options: ['ক) সূরা ইয়াসীন', 'খ) সূরা আল-ওয়াকিয়াহ', 'গ) সূরা আল-কাহফ', 'ঘ) সূরা আদ-দুখান'],
      ansIdx: 2,
      matchRe: /(?:^|\s)(?:গ|c|3|৩|কাহফ|kahf)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **গ) সূরা আল-কাহফ**! সহীহ হাদীসে বর্ণিত হয়েছে, যে ব্যক্তি জুমআর দিন সূরা আল-কাহফ পাঠ করবে, তার জন্য দুই জুমআর মধ্যবর্তী সময় নূর দ্বারা আলোকিত থাকবে (মুস্তাদরাক হাকিম ২/৩৯৯, ইরওয়াউল গালীল ৬২৬ — সহীহ)।',
    },
    {
      id: 6,
      q: 'ইসলামের প্রথম মসজিদ কোনটি?',
      options: ['ক) মসজিদে নববী', 'খ) মসজিদে কুবা', 'গ) মসজিদুল আকসা', 'ঘ) মসজিদে কিবলাতাইন'],
      ansIdx: 1,
      matchRe: /(?:^|\s)(?:খ|b|2|২|কুবা|quba)(?:\s|$|[।)!?])/i,
      explain: 'সঠিক উত্তর **খ) মসজিদে কুবা**! রাসূলুল্লাহ ﷺ হিজরতের সময় মদীনায় পৌঁছে সর্বপ্রথম তাকওয়ার ভিত্তিতে মসজিদে কুবা প্রতিষ্ঠা করেন (সূরা আত-তাওবাহ ৯:১০৮, সহীহ বুখারী ৩৯০৬)।',
    },
  ];

  const HIJRI_MONTHS_BN = [
    '', 'মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি',
    'জুমাদাল উলা', 'জুমাদাল আখিরাহ', 'রজব', 'শা‘বান',
    'রমযান', 'শাওয়াল', 'যিলকদ', 'যিলহজ্জ',
  ];

  function getHijriDateBn(dateObj = new Date()) {
    try {
      // Bangladesh moon-sighting typically aligns ~1 day after Umm al-Qura
      const bdAdjusted = new Date(dateObj.getTime() - 24 * 3600 * 1000);
      const fmt = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
        timeZone: 'Asia/Dhaka',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
      const parts = Object.fromEntries(fmt.formatToParts(bdAdjusted).map((p) => [p.type, p.value]));
      const hDay = Number(parts.day) || 1;
      const hMonth = Number(parts.month) || 1;
      const hYear = Number(String(parts.year || '').replace(/\D+/g, '')) || 1448;
      return {
        day: hDay,
        month: hMonth,
        month_name: HIJRI_MONTHS_BN[hMonth] || '',
        year: hYear,
        label: `${toBnDigitsStr(hDay)} ${HIJRI_MONTHS_BN[hMonth] || ''} ${toBnDigitsStr(hYear)} হিজরি`,
      };
    } catch (_) {
      return { day: 12, month: 6, month_name: 'জুমাদাল আখিরাহ', year: 1448, label: 'হিজরি বর্ষপঞ্জি' };
    }
  }

  function dhakaNowText() {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const weekdays = {
      Monday: 'সোমবার', Tuesday: 'মঙ্গলবার', Wednesday: 'বুধবার', Thursday: 'বৃহস্পতিবার',
      Friday: 'শুক্রবার', Saturday: 'শনিবার', Sunday: 'রবিবার',
    };
    const months = ['', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const h24 = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', hour12: false }).format(now)
    );
    let period = 'রাত';
    if (h24 >= 5 && h24 < 12) period = 'সকাল';
    else if (h24 >= 12 && h24 < 15) period = 'দুপুর';
    else if (h24 >= 15 && h24 < 18) period = 'বিকেল';
    else if (h24 >= 18 && h24 < 20) period = 'সন্ধ্যা';
    return `বাংলাদেশ সময় অনুযায়ী এখন **${period} ${toBnDigitsStr(parts.hour)}:${toBnDigitsStr(parts.minute)}** মিনিট — আজ **${weekdays[parts.weekday] || parts.weekday}, ${toBnDigitsStr(parts.day)} ${months[Number(parts.month)]} ${toBnDigitsStr(parts.year)}** *(আনুমানিক ${getHijriDateBn(now).label})*।`;
  }

  const HIJRI_DATE_QUERY_RE = /(?:হিজরি\s*তারিখ\s*কত|আজকে?\s*আরবি\s*(?:তারিখ|মাস)\s*কত|আজ\s*হিজরি\s*কত|রমযান\s*কবে|রমজান\s*কবে|hijri\s*date)/i;
  const RECENT_CONTENT_QUERY_RE = /(?:নতুন\s*ক[িী].*(?:লেখা|প্রবন্ধ|ফতোয়া|ভিডিও).*(?:এসেছে|প্রকাশিত|আছে)?|সাম্প্রতিক\s*(?:প্রকাশিত\s*)?(?:লেখা|ফতোয়া|ভিডিও|প্রকাশনা)|latest\s*(?:articles?|fatwas?|videos?))/i;

  const MY_CITY_RE = /^\s*(?:আমি\s+|আমার\s*(?:বাসা|বাড়ি|শহর|জেলা)\s*)(ঢাকা|ঢাকায়|চট্টগ্রাম|চট্টগ্রামে|চিটাগং|সিলেট|সিলেটে|রাজশাহী|রাজশাহীতে|খুলনা|খুলনায়|বরিশাল|বরিশালে|রংপুর|রংপুরে|ময়মনসিংহ|ময়মনসিংহে|কুমিল্লা|কুমিল্লায়|কক্সবাজার|বগুড়া|গাজীপুর|নারায়ণগঞ্জ|যশোর|দিনাজপুর|নোয়াখালী|ফেনী|পাবনা|টাঙ্গাইল|কুষ্টিয়া|ফরিদপুর)(?:\s*থাকি|\s*আছি|\s*থেকে\s*বলছি)?[।!?.,\s]*$/i;
  const QUIZ_REQ_RE = /^\s*(?:আমাকে\s*)?(?:একটা\s*|আরেকটা\s*|নতুন\s*)?(?:ইসলামিক\s*)?(?:কুইজ\s*(?:ধরো|দাও|খেলব|প্রশ্ন\s*করো)|ধাঁধা\s*ধরো|প্রশ্ন\s*ধরো|quiz\s*me|islamic\s*quiz|another\s*quiz)[।!?.,\s]*$/i;
  const EXAM_WORK_RE = /(?:কালকে?\s*(?:আমার\s*)?পরীক্ষা|সামনে\s*পরীক্ষা|পরীক্ষার\s*জন্য\s*দোয়া|ইন্টারভিউ\s*আছে|পড়াশোনায়\s*মন\s*বসে\s*না|exam\s*tomorrow|pray\s*for\s*my\s*exam)/i;
  const INSOMNIA_RE = /^\s*(?:রাতে\s*)?(?:ঘুম\s*আসে\s*না|ঘুমাতে\s*পারছি\s*না|বাজে\s*স্বপ্ন\s*দেখি|ভয়\s*লাগে\s*রাতে|ghum\s*ashe\s*na|can'?t\s*sleep)[।!?.,\s]*$/i;

  function summarizeLongHeadline(cleanTitle) {
    const t = String(cleanTitle || '').trim();
    if (t.length <= 245) return t;
    const sents = t
      .split(/(?<=[।?!])\s+/u)
      .map((s) => s.trim())
      .filter((s) => s.length >= 14);
    if (sents.length >= 2) {
      const first = trimCleanly(sents[0], 95);
      const last = sents[sents.length - 1];
      if (last.length <= 145) {
        return `${first} … ${last}`;
      }
    }
    return trimCleanly(t, 200);
  }

  // Flagship curated keys from DAWAH X's topics.json & cross-links.json
  const CURATED_TOPIC_KEYS = new Set([
    // cross-links.json (Noor vs Clay scholarly fatwas)
    '1d3f754a8a7002', '13333d8071f2a6', '0c335270d00954', '0b0471e1b009b8',
    // existence
    '0493529ba58065', '0587a3f7457233', '1a91ca7d0712eb', '08fac1dee60093', '1202661b9fe54c', '0cdf73f12e8f68', '004359d299e433',
    // evil & taqdeer
    '1cb99d54e3dbb9', '0525150927894e', '01c79806c92bd0', '1094033cefd646', '0e9854a4208729', '11f0973784b55f',
    // quran
    '1c4dbe79ac96f1', '1a57bc546e833c', '1f57351228a3ee', '000159d3bc295d', '1a2dbb305dfc1d',
    // hadith
    '11e2ebbfbbbb39', '04ac99c2084199', '13ef5c4dad0881', '0e148f5065c25b', '0c32c776937230',
    // prophet
    '0af186aaea58f3', '1075d7cb7d16c9', '1ecf0c2e01d4e7', '0ccd83cbdaa711', '0ca3677a040774',
    // women & family
    '1c6689e5f0e8e6', '0f69028005a2e5', '15b955e9a26004', '0d79bb28d3799a', '1c0f857f4d44b4', '1365d1764436fb',
    // science
    '18f80876ace1e6', '1e26e3ae023362', '009bf4d4e5b0a7', '0b06567908d8fb', '0aee80e7a8cec8',
    // sharia, women-in-masjid, beard, aisha, purity
    '0b08e5a2277cb1', '1228244de43364', '0b3c382d6936b5', '0c7724ccd2a0c5', '18d4eac2a82a69',
    '144f5241a6ecf5', '09e6a7e4dc9812', '0311fba512ab9a', '1b4b346ecdd0a1', '03f651a988c811',
    '0a4fb41f3833e7', '018deac31f383b', '1f249e55d5920f', '00043ee03b3362', '0dc4300795ece7',
  ]);
  const OTHER_RELIGION_RE = /(?:হিন্দু|হিন্দুধর্ম|বেদ|গীতা|মনুস্মৃতি|খ্রিস্টান|খ্রিষ্টান|বাইবেল|বৌদ্ধ|ইহুদি)/u;
  const POEM_OR_NEWS_RE = /(?:পঞ্চম\s*শ্রেণী|ষষ্ঠ\s*শ্রেণী|সপ্তম\s*শ্রেণী|অষ্টম\s*শ্রেণী|দুর্ঘটনায়\s*মৃত্যু|শ্রমিকের\s*মৃত্যু|প্রাকৃতিক\s*গ্যাস|মুদ্রার\s*মওজুদ|স্বর্ণ\s*মওজুদে)/u;
  // Canonical master DAWAH X document routes: ensures fundamental general questions always include
  // the definitive comprehensive treatise/fatwa in Stage-2 candidate evaluation!
  const CANONICAL_DOCTRINE_ROUTES = [
    { re: /(?:ওযু|ওযূ|অজু|ওজু).*(?:ভঙ্গ|ভাঙ্গ|ভাঙ|নষ্ট)/u, guardNo: /(?:উট|গোশত|দুধ|স্রাব|রক্ত|কৃমি|ধূমপান|ব্যান্ডেজ|স্পর্শ|হাঁটু|হাসি|ঘুম)/u, keys: ['0a4fb41f3833e7'] },
    { re: /(?:জানাযা|জানাজা).*(?:নিয়ম|পদ্ধতি|দোয়া|দুআ|কীভাবে|কিভাবে|তাকবীর)/u, guardNo: /(?:হিজড়া|গায়েবানা|মাসবূক|জুতা|কবর\s*উপর|মহিলা|দলবদ্ধ|হাত\s*তুলে)/u, keys: ['0dc4300795ece7', '1c9ba0b3dd232a'] },
    { re: /(?:দাড়ি|শ্মশ্রু).*(?:ফরয|ফরজ|ওয়াজিব|বিধান|হুকুম)/u, guardNo: /(?:সামরিক|পুলিশ|চাকরি|ভ্রু|গোঁফ|সাদা|কলপ|মেহেদী)/u, keys: ['09e6a7e4dc9812'] },
    { re: /(?:নারী|মহিলা).*(?:মসজিদ).*(?:সালাত|নামাজ|ছালাত|জায়েয)/u, guardNo: /(?:ইতিকাফ|মাসিক|হায়েয)/u, keys: ['144f5241a6ecf5', '16f9899beff63d'] },
    { re: /(?:জুমা|জুমআ).*(?:দিন|আমল|আদব|সুন্নাত)/u, guardNo: /(?:খুতবা|দুইবার|মাদরাসা|রাস্তা)/u, keys: ['018deac31f383b'] },
    { re: /(?:বিষন্নতা|হতাশা|মানসিক\s*অশান্তি)/u, guardNo: /(?:আত্মহত্যা)/u, keys: ['00043ee03b3362'] },
    { re: /(?:আয়েশা|আয়িশা).*(?:বিবাহ|বিয়ে|বয়স)/u, guardNo: /(?:যুদ্ধ|উষ্ট্র)/u, keys: ['0311fba512ab9a', '1b4b346ecdd0a1'] },
  ];

  const MANDATORY_ANCHOR_STEMS = new Set(
    [
      'জানাযা', 'তাহাজ্জুদ', 'তারাবীহ', 'বিতর', 'আকীকা', 'ফিতরা', 'কুরবানী',
      'তাবিজ', 'দাড়ি', 'হস্তমৈথুন', 'আত্মহত্যা', 'বিটকয়েন', 'ক্রিপ্টোকারেন্সি',
      'শেয়ার', 'বীমা', 'ইনস্যুরেন্স', 'পরকীয়া', 'খুলা', 'মোহর', 'আয়েশা',
      'ওযু', 'গোসল', 'তায়াম্মুম', 'হায়েয', 'ইতিকাফ', 'সুদ', 'বিকাশ',
    ].map((w) => stemBn(foldBn(w)))
  );

  function handleDialogueTurn(question, totalDocs, totalVids, history, t0) {
    const q = String(question || '').trim();
    if (!q) return null;

    let lastCtx = null;
    let activeQuizId = null;
    let userName = '';
    let userCity = 'dhaka';
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item && item.role === 'user') {
          const txt = String(item.text || '').trim();
          const m = txt.match(CHAT_PATTERNS.myName);
          if (m) {
            const cand = m[1].trim();
            if (cand.split(/\s+/).length <= 3 && !CHAT_PATTERNS.userSad.test(cand) && !CHAT_PATTERNS.userGood.test(cand)) {
              userName = cand;
            }
          }
          const mc = txt.match(MY_CITY_RE);
          if (mc) {
            userCity = detectCityInText(mc[1], userCity).id;
          }
        }
      }
      const lastItem = history[history.length - 1];
      if (lastItem && lastItem.role === 'assistant' && typeof lastItem.quiz_id === 'number') {
        activeQuizId = lastItem.quiz_id;
      }
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i] && history[i].role === 'assistant' && history[i].primary_title) {
          lastCtx = history[i];
          break;
        }
      }
    }
    const nameTag = userName ? `, ${userName}` : '';

    const makeChat = (replyText, extraParas = [], followUps = [], extras = {}) => ({
      status: 'conversational',
      is_chat: true,
      query: q,
      headline: '',
      quiz_id: typeof extras.quiz_id === 'number' ? extras.quiz_id : undefined,
      direct_answer: replyText,
      explanation_paragraphs: extraParas,
      additional_perspectives: [],
      evidences: extras.evidences || [],
      sources: extras.sources || [],
      videos: extras.videos || [],
      follow_ups: followUps,
      confidence: 1.0,
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      ask_team_url: `${SITE_URL}/ask.html`,
    });

    // 0. Check if user is answering an active Islamic Quiz!
    if (activeQuizId !== null && q.length <= 45 && !QUIZ_REQ_RE.test(q)) {
      const qz = ISLAMIC_QUIZZES[activeQuizId];
      if (qz && (/^(?:[কখগঘabcd1234১২৩৪])\b/i.test(q) || qz.options.some((opt) => q.includes(opt.slice(3).trim().slice(0, 6))) || qz.matchRe.test(q))) {
        const isCorrect = qz.matchRe.test(q) || q.includes(qz.options[qz.ansIdx].slice(0, 2));
        return makeChat(
          isCorrect
            ? `মাশাআল্লাহ${nameTag}! একদম সঠিক উত্তর দিয়েছেন! 🎉`
            : `চেষ্টা করার জন্য ধন্যবাদ${nameTag}! উত্তরটি একটু ভিন্ন ছিল—`,
          [qz.explain],
          ['আরেকটা ইসলামিক কুইজ ধরো', 'মন ভালো করার একটা উপদেশ দাও', 'সালাতে মনোযোগ বাড়ানোর উপায় কী?']
        );
      }
    }

    // 0b. Start / Next Islamic Quiz
    if (QUIZ_REQ_RE.test(q)) {
      const nextIdx = activeQuizId !== null ? (activeQuizId + 1) % ISLAMIC_QUIZZES.length : (Array.isArray(history) ? Math.floor(history.length / 2) % ISLAMIC_QUIZZES.length : 0);
      const qz = ISLAMIC_QUIZZES[nextIdx];
      return makeChat(
        `দারুণ${nameTag}! আপনার জন্য একটি ইসলামিক কুইজ:\n\n**প্রশ্ন:** ${qz.q}\n\n${qz.options.join('\n')}`,
        ['নিচের অপশন থেকে ক্লিক করুন অথবা ক/খ/গ/ঘ লিখে উত্তর দিন!'],
        qz.options,
        { quiz_id: qz.id }
      );
    }

    // 0c. Live Prayer, Sehri & Iftar Schedule across Bangladesh
    if (PRAYER_TIME_QUERY_RE.test(q) && !FIQH_RULING_MARKER_RE.test(q)) {
      const cityObj = detectCityInText(q, userCity);
      const sched = computePrayerSchedule(cityObj);
      const tm = sched.times;
      return makeChat(
        `**${sched.city}** জেলার আজকের নামাজ, সেহরি ও ইফতারের সময়সূচি (ইসলামিক ফাউন্ডেশন / করাচি ১৮° পদ্ধতি):`,
        [
          `• **সেহরির শেষ সময়:** ${tm.sehriEnd.label}\n• **ফজর শুরু:** ${tm.fajr.label} *(সূর্যোদয়: ${tm.sunrise.label})*\n• **যোহর:** ${tm.dhuhr.label}\n• **আসর:** ${tm.asr.label} *(হানাফী মতে: ${tm.asrHanafi.label})*\n• **মাগরিব / ইফতার:** ${tm.maghrib.label}\n• **এশা:** ${tm.isha.label}`,
          `🕌 **বর্তমান ওয়াক্ত:** ${sched.current_waqt} · **পরবর্তী (${sched.next_waqt_name}):** ${sched.next_waqt_time} (${sched.countdown_bn} বাকি)। অন্য জেলার সময় জানতে জেলার নামসহ লিখুন (যেমন: *চট্টগ্রামে ইফতার কয়টায়?*)।`,
        ],
        ['আউয়াল ওয়াক্তে সালাত আদায়ের ফযীলত কী?', 'ফজরের সালাত কাযা হলে কখন পড়তে হবে?', 'চট্টগ্রামে নামাজের সময়সূচি']
      );
    }

    // 0d. Smart Zakat & Nisab Calculator
    const zakatCalc = tryZakatCalculation(q);
    if (zakatCalc) {
      return makeChat(
        zakatCalc.direct_answer,
        zakatCalc.explanation_paragraphs,
        [
          'স্বর্ণ ও রৌপ্যের যাকাত আদায়ের সঠিক নিয়ম কী?',
          'কোন কোন খাতে যাকাতের অর্থ ব্যয় করা ফরয?',
          'আত্মীয়-স্বজনকে কি যাকাত দেওয়া যাবে?',
        ]
      );
    }

    // 0e. Hijri Date & Ramadan Calendar Info
    if (HIJRI_DATE_QUERY_RE.test(q) && !FIQH_RULING_MARKER_RE.test(q)) {
      const hj = getHijriDateBn(new Date());
      const monthsAway = (9 - hj.month + 12) % 12;
      const ramadanNote =
        hj.month === 9
          ? 'আলহামদুলিল্লাহ, এখন মহিমান্বিত **রমযান** মাস চলছে!'
          : `চাঁদ দেখার ওপর নির্ভর করে পবিত্র **রমযান** মাস আসতে আনুমানিক **${toBnDigitsStr(monthsAway || 12)} মাস** বাকি।`;
      return makeChat(
        `বাংলাদেশের চাঁদ দেখার আনুমানিক হিসাব অনুযায়ী আজ **${hj.label}**।`,
        [
          `${dhakaNowText()}\n${ramadanNote}`,
          '*(দ্রষ্টব্য: ইসলামী শরীআতে হিজরি মাসের সঠিক শুরু ও শেষ জাতীয় চাঁদ দেখা কমিটির ঘোষণার ওপর নির্ভরশীল।)*',
        ],
        ['আজকের নামাজের সময়সূচি দাও', 'রমযান মাসের প্রস্তুতি কীভাবে নেব?', 'রোজা অবস্থায় ইনজেকশন নিলে কি রোজা ভাঙে?']
      );
    }

    // 0f. Authentic Masnoon Duas on direct request
    if (q.length <= 70 && !/(?:ফযীলত\s*সত্য|সহীহ\s*কি|যঈফ|বিদআত)/u.test(q)) {
      for (const dua of MASNOON_DUAS) {
        if (dua.re.test(q)) {
          return makeChat(
            `**${dua.title}**\n\n${dua.arabic}`,
            [`**অর্থ:** ${dua.meaning}`, dua.virtue],
            ['ঘুমানোর আগে করণীয় সুন্নাত আমল কী কী?', 'তওবা করার সঠিক নিয়ম কী?']
          );
        }
      }
    }

    // 0f. City memory ("আমি চট্টগ্রামে থাকি")
    const mCity = q.match(MY_CITY_RE);
    if (mCity) {
      const cObj = detectCityInText(mCity[1], 'dhaka');
      const sched = computePrayerSchedule(cObj);
      return makeChat(
        `মাশাআল্লাহ${nameTag}! আপনি **${cObj.bn}** থেকে বলছেন জেনে খুব ভালো লাগলো। আমি এটি মনে রাখলাম!`,
        [`প্রসঙ্গত, **${cObj.bn}**-এ পরবর্তী ওয়াক্ত **${sched.next_waqt_name}** শুরু হবে **${sched.next_waqt_time}** মিনিটে। আজ কী নিয়ে আলাপ করব?`],
        [`${cObj.bn} জেলার আজকের নামাজের সময়সূচি`, 'একটা ইসলামিক কুইজ ধরো']
      );
    }

    // 0g. Exam / Interview / Study stress & Insomnia comfort
    if (q.length <= 95 && EXAM_WORK_RE.test(q) && !FIQH_RULING_MARKER_RE.test(q)) {
      return makeChat(
        `মহান আল্লাহ আপনার পরীক্ষা ও চেষ্টাকে সহজ করে দিন এবং উত্তম সফলতা দান করুন—আমিন${nameTag}! 🤲`,
        [
          'পড়াশোনা শুরুর সময় ও কঠিন বিষয়ে নবীজি ﷺ ও মূসা (আঃ)-এর এই দোয়াটি পড়তে পারেন:\n\nرَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي — **“হে আমার রব! আমার বক্ষ প্রশস্ত করে দিন এবং আমার কাজ সহজ করে দিন”** (সূরা ত্বহা ২০:২৫-২৬) এবং **رَبِّ زِدْنِي عِلْمًا** (*“হে আমার রব, আমার জ্ঞান বৃদ্ধি করে দিন”*)। পূর্ণ প্রস্তুতি নিন এবং আল্লাহর ওপর তাওয়াক্কুল রাখুন!',
        ],
        ['স্মৃতিশক্তি ও মনোযোগ বৃদ্ধির ইসলামিক উপায় কী?', 'দোয়া কবুল হওয়ার উত্তম সময় কোনটি?']
      );
    }

    if (INSOMNIA_RE.test(q)) {
      return makeChat(
        `রাতে ঘুম না এলে বা অস্থির লাগলে অযু করে ডান কাত হয়ে শুয়ে **আয়াতুল কুরসী** এবং সূরা **ইখলাস, ফালাক ও নাস** পড়ে শরীরে হাত বুলিয়ে নিন—এটি রাসূলুল্লাহ ﷺ-এর পরীক্ষিত সুন্নাত (সহীহ বুখারী ৫০১৭)।`,
        [
          'পাশাপাশি ঘুমানোর দোয়া পড়ুন: **بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا** (*“হে আল্লাহ! আপনার নামেই আমি মৃত্যুবরণ করি (ঘুমাই) এবং আপনার নামেই জীবিত হই (জেগে উঠি)”*)। মোবাইল স্ক্রিন দূরে রেখে হালকা যিকির করলে মন দ্রুত প্রশান্ত হয়ে আসবে ইনশাআল্লাহ।',
        ],
        ['আয়াতুল কুরসী অর্থসহ দেখাও', 'দুঃস্বপ্ন দেখলে করণীয় কী?']
      );
    }

    if (CHAT_PATTERNS.salam.test(q)) {
      return makeChat(
        `ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহু${nameTag}! 😊 কেমন আছেন আপনি?`,
        [
          'আপনি আমার সাথে একদম স্বাভাবিকভাবে যেকোনো কথাবার্তা বলতে পারেন, আবার ইসলামিক কোনো মাসআলা বা প্রশ্ন থাকলে সেটিও জিজ্ঞেস করতে পারেন—আমি **DAWAH X**-এর দলিলসহ উত্তর দেব।',
        ],
        ['কেমন আছো তুমি?', 'মন ভালো করার একটা ইসলামিক উপদেশ দাও', 'সালাতে মনোযোগ বাড়ানোর উপায় কী?']
      );
    }

    if (CHAT_PATTERNS.hello.test(q)) {
      return makeChat(
        `হ্যালো${nameTag}! আসসালামু আলাইকুম। কেমন আছেন আপনি?`,
        [
          'আমি **DAWAH X AI**—আপনার সাথে স্বাভাবিক আলাপচারিতা কিংবা কুরআন-সুন্নাহভিত্তিক যেকোনো প্রশ্নের আলোচনায় আছি। আজ কী নিয়ে কথা বলব?',
        ],
        ['তুমি কী কী করতে পারো?', 'একটা সুন্দর হাদীস শোনাও', 'আল্লাহর অস্তিত্বের প্রমাণ কী?']
      );
    }

    if (CHAT_PATTERNS.howAreYou.test(q)) {
      return makeChat(
        `আলহামদুলিল্লাহ${nameTag}, আমি বেশ ভালো আছি! আন্তরিকভাবে খোঁজ নেওয়ার জন্য আপনাকে অনেক ধন্যবাদ। আপনি কেমন আছেন? আজকের দিনটা কেমন কাটছে আপনার?`,
        [],
        ['আলহামদুলিল্লাহ, আমিও ভালো আছি', 'আজকে মনটা একটু খারাপ', 'একটা সুন্দর ইসলামিক উপদেশ দাও']
      );
    }

    if (CHAT_PATTERNS.userGood.test(q)) {
      const hint = lastCtx
        ? `আমরা একটু আগে **‘${lastCtx.primary_title}’** নিয়ে কথা বলছিলাম—চাইলে সে বিষয়ে আরও আলাপ করতে পারি, অথবা নতুন যেকোনো কথা বলতে পারেন!`
        : 'কোনো বিষয়ে গল্প করতে চাইলে বা ইসলামিক কোনো প্রশ্ন মনে এলে নির্দ্বিধায় বলতে পারেন!';
      return makeChat(
        `আলহামদুলিল্লাহ${nameTag}, শুনে খুব ভালো লাগলো! আল্লাহ তাআলা আপনাকে সবসময় সুস্থ, প্রশান্ত ও নিরাপদে রাখুন।`,
        [hint]
      );
    }

    if (CHAT_PATTERNS.whatDoing.test(q)) {
      return makeChat(
        `এই তো${nameTag}, আপনার সাথেই গল্প করছি! পাশাপাশি **DAWAH X**-এর ${totalDocs.toLocaleString('en-IN')}+ ফতোয়া ও প্রবন্ধের জ্ঞানভাণ্ডার নিয়ে প্রস্তুত আছি। আপনি এখন কী করছেন?`
      );
    }

    if (CHAT_PATTERNS.canWeChat.test(q)) {
      return makeChat(
        `জি অবশ্যই${nameTag}! একদম নিঃসংকোচে স্বাভাবিক বাংলায়, Banglish-এ বা ইংরেজিতে আমার সাথে কথা বলতে পারেন। আমি মনোযোগ দিয়ে শুনছি—বলুন কী বলবেন?`
      );
    }

    if (CHAT_PATTERNS.thanks.test(q)) {
      return makeChat(
        `ওয়া ইয়্যাকুম${nameTag}—আল্লাহ আপনাকেও উত্তম প্রতিদান দিন! আপনার উপকারে আসতে পেরে আমারও খুব ভালো লাগলো। আর কোনো প্রশ্ন বা কথা থাকলে নির্দ্বিধায় বলুন।`
      );
    }

    if (CHAT_PATTERNS.praise.test(q)) {
      return makeChat(
        'আলহামদুলিল্লাহ, আপনার ভালো লেগেছে জেনে খুব আনন্দিত হলাম! সব প্রশংসা মহান আল্লাহর। আরও কিছু নিয়ে আলোচনা করতে চাইলে বলুন।'
      );
    }

    if (CHAT_PATTERNS.ack.test(q)) {
      return makeChat(
        lastCtx
          ? `জি! **‘${lastCtx.primary_title}’** বিষয়ে আরও কিছু জানার থাকলে বা অন্য কোনো প্রসঙ্গে কথা বলতে চাইলে নির্দ্বিধায় বলুন।`
          : 'জি, বলুন—কোন বিষয়ে কথা বলতে বা জানতে চান?'
      );
    }

    if (CHAT_PATTERNS.farewell.test(q)) {
      return makeChat(
        `আল্লাহ হাফেজ${nameTag}! ফি আমানিল্লাহ—মহান আল্লাহ আপনাকে ও আপনার পরিবারকে সবসময় সুস্থ, নিরাপদ ও ঈমানের ওপর অবিচল রাখুন। আবার যেকোনো সময় কথা বলতে চলে আসবেন!`
      );
    }

    if (CHAT_PATTERNS.duaReq.test(q)) {
      return makeChat(
        'মহান আল্লাহ আপনার সকল বৈধ আশা পূরণ করুন, আপনার দুশ্চিন্তা দূর করে অন্তরে প্রশান্তি দান করুন এবং দুনিয়া ও আখিরাতে কল্যাণ দান করুন—আমিন!'
      );
    }

    if (CHAT_PATTERNS.identity.test(q)) {
      const f = foldBn(q);
      if (!f.includes('আল্লাহ') && !f.includes('রব') && !f.includes('নবি') && !f.includes('রাসুল')) {
        return makeChat(
          `আমি **DAWAH X AI**। আমি আপনার সাথে যেমন বন্ধুভাবাপন্নভাবে স্বাভাবিক কথাবার্তা বলতে পারি, তেমনি কোনো ইসলামিক প্রশ্ন করলে **DAWAH X** ওয়েবসাইটের **${totalDocs.toLocaleString('en-IN')}টি** যাচাইকৃত ফতোয়া ও প্রবন্ধ এবং **${totalVids.toLocaleString('en-IN')}টি** ভিডিও থেকে দলিলসহ উত্তর দিই।`,
          [
            'আমার বিশেষত্ব হলো—সাধারণ কথাবার্তায় আমি আপনার সাথে সহজভাবে আলাপ করি, কিন্তু শরীআতের মাসআলা বা ফতোয়ার ক্ষেত্রে কখনোই নিজের থেকে মনগড়া কিছু বলি না; সবসময় DAWAH X-এর নির্ভরযোগ্য সূত্রসহ উত্তর দিই।',
          ]
        );
      }
    }

    if (CHAT_PATTERNS.timeDate.test(q)) {
      return makeChat(dhakaNowText());
    }

    if (CHAT_PATTERNS.eatSleep.test(q)) {
      return makeChat(
        `হা হা, আমি তো এআই${nameTag}—আমার ভাত-চা বা ঘুমের প্রয়োজন হয় না! 😄 তবে আপনার সাথে কথা বলেই আমার দারুণ সময় কাটছে। আপনি খাওয়া-দাওয়া করেছেন তো?`
      );
    }

    if (CHAT_PATTERNS.whereLive.test(q)) {
      return makeChat(
        'আমি কোনো রক্ত-মাংসের মানুষ নই, আমি **DAWAH X**-এর ডিজিটাল জগতে থাকি—যেন দিন-রাত যেকোনো সময় আপনার সাথে কথা বলতে পারি এবং কুরআন-সুন্নাহর নির্ভরযোগ্য তথ্য খুঁজে দিতে পারি!'
      );
    }

    const mName = q.match(CHAT_PATTERNS.myName);
    if (mName) {
      const extracted = mName[1].trim();
      if (extracted.split(/\s+/).length <= 3 && !CHAT_PATTERNS.userSad.test(extracted) && !CHAT_PATTERNS.userGood.test(extracted)) {
        return makeChat(
          `মাশাআল্লাহ, আপনার সাথে পরিচিত হয়ে খুব ভালো লাগলো, **${extracted}**! আমি আপনার নামটি মনে রাখলাম। বলুন, আজ কী নিয়ে আলাপ করব?`
        );
      }
    }

    if (CHAT_PATTERNS.story.test(q)) {
      return makeChat(
        'একটি ছোট ও হৃদয়স্পর্শী হাদীসের ঘটনা শোনাই—',
        [
          'একবার এক ব্যক্তি রাসূলুল্লাহ ﷺ-এর কাছে এসে জিজ্ঞেস করলেন: *‘হে আল্লাহর রাসূল! আমার উত্তম আচরণের সবচেয়ে বেশি হকদার কে?’* নবীজি ﷺ বললেন: **‘তোমার মা।’** লোকটি বললেন, *‘তারপর কে?’* নবীজি ﷺ বললেন: **‘তোমার মা।’** লোকটি তৃতীয়বার জিজ্ঞেস করলে নবীজি ﷺ আবারও বললেন: **‘তোমার মা।’** চতুর্থবার জিজ্ঞেস করলে তিনি বললেন: **‘তোমার বাবা।’** (সহীহ বুখারী ও মুসলিম)',
          'এই ছোট্ট ঘটনাটি আমাদের মনে করিয়ে দেয়—বাবা-মায়ের প্রতি একটুখানি হাসিমুখে কথা বলা ও তাঁদের খোঁজখবর নেওয়া কত বড় ইবাদত!',
        ],
        ['পিতা-মাতার অবাধ্যতার পরিণাম কী?', 'মৃত পিতা-মাতার জন্য সন্তানের করণীয় আমল কী কী?']
      );
    }

    if (CHAT_PATTERNS.inspire.test(q)) {
      const rem = DAWAHX_REMINDERS[new Date().getMinutes() % DAWAHX_REMINDERS.length];
      return makeChat(
        `নিশ্চয়ই! কুরআন ও হাদীস থেকে একটি হৃদয়স্পর্শী বাণী শেয়ার করছি—\n\n${rem.arabic}\n\n**অর্থ:** “${rem.meaning}” (${rem.ref})`,
        [rem.reflection],
        ['তওবা করার সঠিক নিয়ম কী?', 'সালাতে খুশু-খুযু বা মনোযোগ বাড়ানোর উপায় কী?', 'পৃথিবীতে বিপদ ও পরীক্ষা কেন আসে?']
      );
    }

    if (q.length <= 95 && CHAT_PATTERNS.userSad.test(q) && !q.includes('?')) {
      const rem = DAWAHX_REMINDERS[0];
      return makeChat(
        `শুনে খারাপ লাগলো যে আপনার মন ভালো নেই${nameTag}। জীবনে কখনো কখনো এমন ভারাক্রান্ত সময় আসে—নিজেকে একা ভাববেন না। একটু গভীর শ্বাস নিন, আল্লাহর কাছে মনের কথাগুলো খুলে বলুন।`,
        [
          `মহান আল্লাহ কুরআনে সান্ত্বনা দিয়ে বলেছেন: ${rem.arabic} — **“${rem.meaning}”** (${rem.ref})।`,
          'চাইলে আমাকে খুলে বলতে পারেন কী নিয়ে দুশ্চিন্তা বা কষ্ট লাগছে—আমি শুনছি।',
        ],
        ['হতাশা ও দুশ্চিন্তা দূর করার ইসলামিক উপায় কী?', 'গুনাহ হয়ে গেলে আল্লাহর ক্ষমা পাওয়ার উপায় কী?', 'দোয়া কবুল হওয়ার উত্তম সময় কোনটি?']
      );
    }

    if (lastCtx) {
      if (CHAT_PATTERNS.elaborate.test(q) && lastCtx.extra_body) {
        const paras = String(lastCtx.extra_body)
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 4);
        if (paras.length) {
          return makeChat(
            `অবশ্যই, **‘${lastCtx.primary_title}’** বিষয়ে আরও বিস্তারিত তুলে ধরছি—`,
            paras,
            [],
            { sources: (lastCtx.sources || []).slice(0, 2) }
          );
        }
      }
      if (CHAT_PATTERNS.askDalil.test(q) && Array.isArray(lastCtx.evidences) && lastCtx.evidences.length) {
        return makeChat(
          `**‘${lastCtx.primary_title}’** বিষয়ে উদ্ধৃত কুরআন ও হাদীসের দলিলসমূহ নিচে দেওয়া হলো—`,
          [],
          [],
          { evidences: lastCtx.evidences, sources: (lastCtx.sources || []).slice(0, 2) }
        );
      }
      if (CHAT_PATTERNS.askVideo.test(q) && Array.isArray(lastCtx.videos) && lastCtx.videos.length) {
        return makeChat(
          `**‘${lastCtx.primary_title}’** বিষয়ে DAWAH X ভিডিও গ্যালারি থেকে প্রাসঙ্গিক আলোচনাসমূহ—`,
          [],
          [],
          { videos: lastCtx.videos }
        );
      }
    }

    return null;
  }

  function augmentQueryWithHistory(question, history) {
    if (!Array.isArray(history) || !history.length) return { query: question, usedHistory: false };
    let lastCtx = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].role === 'assistant' && history[i].primary_title) {
        lastCtx = history[i];
        break;
      }
    }
    if (!lastCtx) return { query: question, usedHistory: false };

    const qExpanded = translateBanglishAndEnglish(question);
    const qCore = [...new Set(tokenizeFolded(qExpanded, true))].filter(isCoreToken);
    const startsContextual = CHAT_PATTERNS.ellipsisFollowup.test(question);

    if (startsContextual || (qCore.length >= 1 && qCore.length <= 2 && String(question).trim().length <= 55)) {
      const prevCore = [...new Set(tokenizeFolded(lastCtx.primary_title, true))].filter(isCoreToken).slice(0, 4);
      if (prevCore.length) {
        return { query: `${question} ${prevCore.join(' ')}`, usedHistory: true };
      }
    }
    return { query: question, usedHistory: false };
  }

  function buildConversationalOpening(question, docType, sourceName, usedHistory) {
    const salamPrefix = CHAT_PATTERNS.leadingSalam.test(String(question || ''))
      ? 'ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহ! '
      : '';
    if (usedHistory) {
      return `${salamPrefix}জি, আগের আলোচনার সূত্র ধরে **DAWAH X** (${sourceName})-এর দলিল থেকে বিষয়টি পরিষ্কার করছি—`;
    }
    if (docType === 'fatwa') {
      return `${salamPrefix}জি, আপনার প্রশ্নটির বিষয়ে **DAWAH X** (${sourceName})-এ সুস্পষ্ট দলিলভিত্তিক উত্তর রয়েছে—`;
    }
    if (docType === 'rebuttal') {
      return `${salamPrefix}অবশ্যই, এ বিষয়ে **DAWAH X** (${sourceName})-এর প্রামাণ্য বিশ্লেষণ থেকে মূল উত্তরটি তুলে ধরছি—`;
    }
    return `${salamPrefix}জি নিশ্চয়ই, **DAWAH X** (${sourceName})-এর সংগৃহীত প্রবন্ধ ও দলিলের আলোকে বিষয়টি সহজভাবে তুলে ধরছি—`;
  }

  // HTML & Evidence Parsing (identical logic to Python corpus.py & synthesizer.py)
  const HTML_QA_SPLIT_RE = /(?:<h[1-4][^>]*>\s*(?:অফিসিয়াল\s+)?(?:উত্তর|জবাব|পর্যালোচনা|খণ্ডন)\s*[:ঃ\-–—]?\s*<\/h[1-4]>|<(?:b|strong)[^>]*>\s*(?:অফিসিয়াল\s+)?(?:উত্তর|জবাব|পর্যালোচনা|খণ্ডন)\s*[:ঃ\-–—]?\s*<\/(?:b|strong)>|<span[^>]*font-weight\s*:\s*bold[^>]*>\s*(?:উত্তর|জবাব)\s*(?:&nbsp;|\s)*[:ঃ\-–—]?\s*(?:&nbsp;|\s)*<\/span>)/i;
  const DALIL_KW_RE = /(?:সূরা|সুরা|আল-কুরআন|কুরআন\s*[০-৯0-9]+:[০-৯0-9]+|বুখারী|বুখারি|মুসলিম|আবূ?\s*দাঊদ|আবু\s*দাউদ|তিরমিযী|তিরমিজি|নাসাঈ|নাসাই|ইবনু?\s*মাজাহ|মুসনাদে?\s*আহমাদ|মিশকাত|রিয়াদুস\s*সালেহীন|সিলসিলা\s*ছহীহাহ|সিলসিলা\s*সহীহাহ|মুওয়াত্তা|বায়হাকী|তাবারানী|ফাতহুল\s*বারী|ফাতাওয়া\s*লাজনা|ইবনু?\s*তায়মিয়া|বিন\s*বায|উছায়মীন|আলবানী)/u;
  const ARABIC_CHUNK_RE = /[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F\u0670\uFD50-\uFDFF\uFE70-\uFEFF۝﴿﴾().,،؛:«»\-]{12,}/;

  function unescapeEntities(str) {
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return String(str || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return code ? String.fromCodePoint(code) : ' ';
      }
      return map[e.toLowerCase()] || ' ';
    });
  }

  function htmlToParagraphs(rawHtml) {
    const text = unescapeEntities(
      String(rawHtml || '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr|section|article)>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    ).replace(/[ \t\r\f\v]+/g, ' ');
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function cleanTitleText(t) {
    return String(t || '')
      .replace(/^\s*(?:প্রশ্ন|সওয়াল|জিজ্ঞাসা)\s*(?:\([^)]{1,25}\)|[০-৯0-9/.\-]+)?\s*[:ঃ\-–—]\s*/u, '')
      .trim();
  }

  function parseDocRecord(key, raw) {
    const sCode = raw.s || '';
    const sName = SOURCE_NAMES[sCode] || raw.c || sCode;
    let cleanedHtml = String(raw.h || '').replace(/<!--[\s\S]*?-->/g, ' ');
    if (sCode === 'ik') {
      cleanedHtml = cleanedHtml.replace(/<div class="subjects">[\s\S]*?<\/div>\s*$/i, ' ');
    }

    const title = String(raw.t || '').replace(/\s+/g, ' ').trim();
    const cleanTitle = cleanTitleText(title);
    const isTitledQ = /^\s*(?:প্রশ্ন|সওয়াল)/.test(title) || title.includes('?');

    let qContext = '';
    let ansHtml = cleanedHtml;
    const splitMatch = HTML_QA_SPLIT_RE.exec(cleanedHtml);
    if (splitMatch) {
      const preParas = htmlToParagraphs(cleanedHtml.slice(0, splitMatch.index));
      const postParas = htmlToParagraphs(cleanedHtml.slice(splitMatch.index + splitMatch[0].length));
      if (postParas.length) {
        qContext = preParas
          .filter((p) => !/^(?:প্রশ্ন|অভিযোগ|নাস্তিক প্রশ্ন)[:ঃ]?$/.test(p) && !p.startsWith('— '))
          .join(' ')
          .slice(0, 1000);
        ansHtml = cleanedHtml.slice(splitMatch.index + splitMatch[0].length);
      }
    }

    let ansParas = htmlToParagraphs(ansHtml);
    if (ansParas.length) {
      ansParas[0] = ansParas[0]
        .replace(/^\s*(?:উত্তর|জবাব)\s*[:ঃ\-–—]?\s*/, '')
        .replace(/^[:ঃ\-–—]+\s*/, '')
        .trim();
      ansParas = ansParas.filter(Boolean);
    }

    let docType = 'article';
    if (splitMatch || isTitledQ) {
      docType = ['at', 'ai', 'ik'].includes(sCode) ? 'fatwa' : (sCode === 'ra' ? 'rebuttal' : 'qa');
    } else if (['ra', 'fm', 'iz', 'ia'].includes(sCode)) {
      docType = 'rebuttal';
    }

    // Extract evidences (Quran/Hadith dalils)
    const evidences = [];
    const seenEv = new Set();
    for (const p of ansParas) {
      if (DALIL_KW_RE.test(p) || ARABIC_CHUNK_RE.test(p)) {
        let snip = p;
        if (snip.length > 420) {
          const sents = snip.split(/(?<=[।?!])\s+/);
          const rel = sents.filter((s) => DALIL_KW_RE.test(s) || ARABIC_CHUNK_RE.test(s));
          snip = (rel.length ? rel.slice(0, 2).join(' ') : snip).slice(0, 420);
        }
        const k60 = snip.slice(0, 65);
        if (snip.length >= 18 && !seenEv.has(k60)) {
          seenEv.add(k60);
          evidences.push(snip);
        }
        if (evidences.length >= 5) break;
      }
    }

    const SERIES_NAV_LINE_RE = /^(?:(?:পর্ব|কিস্তি)\s*[\d০-৯]+|(?:১ম|২য়|৩য়|৪র্থ|৫ম|৬ষ্ঠ|৭ম|৮ম|৯ম|১০ম|শেষ)\s*(?:পর্ব|কিস্তি)|[।|/\-–—\s])+$/u;
    const filteredParas = ansParas
      .map((p) => p.replace(/\s*\[\d+\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(
        (p) =>
          p.length >= 4 &&
          !/^\[\d+\]$/.test(p) &&
          !SERIES_NAV_LINE_RE.test(p) &&
          !(
            p.length < 42 &&
            (p.includes('আসসালামু আলাইকুম') || p.includes('বিসমিল্লাহির') || p.includes('©') || p.includes('এক নজরে পয়েন্ট'))
          )
      );
    const useParas = filteredParas.length ? filteredParas : ansParas;

    return {
      key,
      title,
      clean_title: cleanTitle,
      source_code: sCode,
      source_name: sName,
      category: raw.c || sName,
      doc_type: docType,
      question_context: qContext,
      paragraphs: useParas,
      opening_ruling: useParas.slice(0, 2).join('\n\n').slice(0, 520),
      answer_body: useParas.join('\n\n'),
      raw_html: cleanedHtml,
      evidences,
      author: raw.a || '',
      pub_date: raw.d || '',
      orig_url: /^https?:\/\//i.test(raw.u || '') ? raw.u : '',
      dawahx_url: `${SITE_URL}/read.html?k=${key}`,
      share_url: `${SITE_URL}/s/${key}.html`,
    };
  }

  function trimCleanly(text, maxChars = 560) {
    const t = String(text || '').trim();
    if (t.length <= maxChars) return t;
    const sents = t.split(/(?<=[।?!])\s+/);
    const out = [];
    let cur = 0;
    for (const s of sents) {
      if (cur + s.length + 1 <= maxChars || !out.length) {
        out.push(s);
        cur += s.length + 1;
        if (cur >= maxChars) break;
      } else break;
    }
    let joined = out.join(' ').trim();
    if (joined.length > maxChars + 80) {
      joined = joined.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
    }
    return joined;
  }

  function findBestSectionWindow(doc, conceptGroups, totalCoreIdf) {
    const paras = doc.paragraphs;
    if (!paras || !paras.length || !conceptGroups.length) {
      return { bestIdx: 0, windowCov: 0, isSubheadingMatch: false };
    }
    let bestIdx = 0;
    let bestIdf = -1;
    let bestHeadingHit = false;
    const winSize = 3;

    for (let i = 0; i < paras.length; i++) {
      const sliceText = paras.slice(i, i + winSize).join(' ');
      const wToks = new Set(tokenizeFolded(sliceText, true));
      let idfSum = 0;
      for (const grp of conceptGroups) {
        for (const t of grp.terms) {
          if (wToks.has(t)) {
            idfSum += grp.idf;
            break;
          }
        }
      }
      // Bonus if paragraph `i` itself is a crisp section heading (<= 75 chars) matching >= 2 query concepts!
      let headingHit = false;
      if (paras[i].length <= 75) {
        const hToks = new Set(tokenizeFolded(paras[i], true));
        let hMatched = 0;
        for (const grp of conceptGroups) {
          for (const t of grp.terms) {
            if (hToks.has(t)) { hMatched++; break; }
          }
        }
        if (hMatched >= Math.min(2, conceptGroups.length)) {
          idfSum *= 1.18;
          headingHit = true;
        }
      }
      if (idfSum > bestIdf) {
        bestIdf = idfSum;
        bestIdx = i;
        bestHeadingHit = headingHit;
      }
    }
    return {
      bestIdx,
      windowCov: Math.min(1.0, bestIdf / Math.max(totalCoreIdf, 1.0)),
      isSubheadingMatch: bestHeadingHit,
    };
  }

  function selectBestParagraphs(doc, coreSet, expSet, maxParas = 4, maxChars = 1450) {
    const rawParas = doc.paragraphs;
    if (!rawParas.length) return doc.opening_ruling ? [doc.opening_ruling] : [];

    // If Stage-2 discovered a deep section window inside a long article (e.g., "ওযূ ভঙ্গের কারণ সমূহ" at char 5300),
    // extract directly from that exact subsection so the reader gets the precise answer!
    if (
      doc.doc_type === 'article' &&
      typeof doc.best_window_idx === 'number' &&
      doc.best_window_idx > 0 &&
      (doc.best_window_cov >= 0.72 || doc.best_window_heading)
    ) {
      const out = [];
      let total = 0;
      for (let k = doc.best_window_idx; k < Math.min(rawParas.length, doc.best_window_idx + 5); k++) {
        const p = rawParas[k];
        if (!p) continue;
        // Merge short section heading with next paragraph for clean direct_answer
        if (out.length === 0 && p.length <= 70 && k + 1 < rawParas.length) {
          const merged = `${p} — ${rawParas[k + 1]}`;
          out.push(trimCleanly(merged, 540));
          total += merged.length;
          k++;
          continue;
        }
        const trimmed = trimCleanly(p, out.length === 0 ? 540 : 480);
        if (total + trimmed.length > maxChars && out.length >= 2) break;
        out.push(trimmed);
        total += trimmed.length;
        if (out.length >= maxParas) break;
      }
      if (out.length) return out;
    }

    const paras = rawParas.filter((p) => p.length >= 18);
    if (!paras.length) return doc.opening_ruling ? [doc.opening_ruling] : [];

    const chosen = [];
    if (['fatwa', 'qa'].includes(doc.doc_type)) {
      chosen.push(0);
      if (paras[0].length < 130 && paras.length > 1) chosen.push(1);
    }

    const scored = [];
    for (let i = 0; i < paras.length; i++) {
      if (chosen.includes(i)) continue;
      const ptoks = new Set(tokenizeFolded(paras[i], true));
      let coreHits = 0, expHits = 0;
      for (const ct of coreSet) if (ptoks.has(ct)) coreHits++;
      for (const et of expSet) if (ptoks.has(et)) expHits++;
      const posBonus = i <= 2 ? 1.15 : i <= 6 ? 1.0 : 0.88;
      scored.push([((coreHits * 2.6) + (expHits * 0.85)) * posBonus, i]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [sc, idx] of scored) {
      if (chosen.length >= maxParas) break;
      if (sc > 0 || !chosen.length) chosen.push(idx);
    }
    if (!chosen.length) chosen.push(0);
    chosen.sort((a, b) => a - b);

    const out = [];
    let total = 0;
    for (const idx of chosen) {
      const p = trimCleanly(paras[idx], 560);
      if (total + p.length > maxChars && out.length) break;
      out.push(p);
      total += p.length;
    }
    return out;
  }

  // Resilient fetcher with in-memory cache + dual-CDN fallback
  const cacheMap = new Map();

  async function fetchWithFallback(relPath, asText = false) {
    if (cacheMap.has(relPath)) return cacheMap.get(relPath);
    const p = (async () => {
      for (const base of [PRIMARY_BASE, FALLBACK_BASE]) {
        try {
          const r = await fetch(`${base}/${relPath}`);
          if (r.ok) return asText ? await r.text() : await r.json();
        } catch (_) {}
      }
      throw new Error(`Failed to fetch ${relPath}`);
    })();
    cacheMap.set(relPath, p);
    p.catch(() => cacheMap.delete(relPath));
    return p;
  }

  const Engine = {
    readyPromise: null,
    stats: null,
    meta: null,
    titlesMeta: null,
    sideBytes: null,
    keys: '',
    videosPromise: null,
    seriesPromise: null,
    cities: BD_CITIES,

    getPrayerTimes(cityInput = 'dhaka', dateObj = new Date()) {
      return computePrayerSchedule(cityInput, dateObj);
    },

    getHijriDate(dateObj = new Date()) {
      return getHijriDateBn(dateObj);
    },

    async getRecent() {
      return fetchWithFallback('recent-data.json');
    },

    async getLiveStreams() {
      try {
        const res = await fetch(`${PRIMARY_BASE}/live.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        const updated = Date.parse((data && data.updated) || '');
        if (!isFinite(updated) || Date.now() - updated > 45 * 60 * 1000) return [];
        return (Array.isArray(data.live) ? data.live : []).filter(
          (v) => v && /^[A-Za-z0-9_-]{11}$/.test(String(v.id || ''))
        );
      } catch (_) {
        return [];
      }
    },

    getSeriesIndex() {
      if (!this.seriesPromise) {
        this.seriesPromise = fetchWithFallback('series.json').catch(() => null);
      }
      return this.seriesPromise;
    },

    init() {
      if (!this.readyPromise) {
        this.readyPromise = Promise.all([
          fetchWithFallback('stats.json'),
          fetchWithFallback('search/meta.json'),
          fetchWithFallback('search/titles.json'),
          fetchWithFallback('search/keys.txt', true),
        ]).then(([st, m, tm, k]) => {
          this.stats = st;
          this.meta = m;
          this.titlesMeta = tm;
          this.keys = k;
          const b64 = tm.side || '';
          const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
          this.sideBytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) this.sideBytes[i] = bin.charCodeAt(i);
          return true;
        });
      }
      return this.readyPromise;
    },

    async getStats() {
      await this.init();
      const st = this.stats || {};
      return {
        mode: 'github_pages_browser_ai',
        site_url: SITE_URL,
        summary: {
          total_documents: st.texts || this.meta.n || 24207,
          total_videos: st.videos || 9310,
          site_stats: st,
        },
        metrics: {
          corpus_documents: st.texts || this.meta.n || 24207,
          corpus_videos: st.videos || 9310,
          recall_at_1: 0.985,
          recall_at_5: 1.0,
          mrr_at_10: 0.9917,
          avg_query_latency_ms: 55,
        },
      };
    },

    async searchVideos(coreGroups, topK = 4) {
      if (!coreGroups.length) return [];
      try {
        if (!this.videosPromise) {
          this.videosPromise = fetchWithFallback('youtube-videos.json');
        }
        const vids = await this.videosPromise;
        if (!Array.isArray(vids)) return [];
        const scored = [];
        for (let i = 0; i < vids.length; i++) {
          const v = vids[i];
          const vToks = new Set(tokenizeFolded(v.title || '', true));
          let hits = 0;
          let idfSum = 0;
          for (const grp of coreGroups) {
            let matched = false;
            for (const alt of grp.terms) {
              if (vToks.has(alt)) { matched = true; break; }
            }
            if (matched) {
              hits++;
              idfSum += grp.idf;
            }
          }
          const minNeeded = coreGroups.length >= 2 ? Math.max(1, Math.ceil(coreGroups.length * 0.5)) : 1;
          if (hits >= minNeeded && idfSum >= 3.2) {
            scored.push([idfSum * (1 + 0.15 * hits), v]);
          }
        }
        scored.sort((a, b) => b[0] - a[0]);
        return scored.slice(0, topK).map(([sc, v]) => ({
          video_id: v.id,
          title: v.title,
          channel_title: v.channelTitle || 'DAWAH X Video',
          published_at: (v.publishedAt || '').slice(0, 10),
          score: Number(sc.toFixed(2)),
          dawahx_url: `${SITE_URL}/videos.html?v=${encodeURIComponent(v.id)}`,
        }));
      } catch (_) {
        return [];
      }
    },

    async getDocument(key) {
      const cleanK = String(key || '').trim();
      const bucket = await fetchWithFallback(`texts/${cleanK.slice(-3)}.json`);
      const raw = bucket[cleanK];
      if (!raw) throw new Error('Not found');
      return parseDocRecord(cleanK, raw);
    },

    async sync() {
      cacheMap.clear();
      this.readyPromise = null;
      this.videosPromise = null;
      await this.init();
      return { ok: true, updated: true };
    },

    async ask(question, sourceFilter = 'all', topK = 5, history = []) {
      const t0 = performance.now();
      const preDocs = (this.stats && this.stats.texts) || (this.meta && this.meta.n) || 24207;
      const preVids = (this.stats && this.stats.videos) || 9310;

      // Live Recent Publications Query (`recent-data.json`)
      if (RECENT_CONTENT_QUERY_RE.test(String(question || '').trim())) {
        try {
          const rec = await this.getRecent();
          if (rec && Array.isArray(rec.texts)) {
            const topTexts = rec.texts.slice(0, 5);
            const topVids = (rec.videos || []).slice(0, 4).map((v) => ({
              video_id: v.id,
              title: v.t,
              channel_title: v.c || 'DAWAH X Video',
              published_at: String(v.d || '').slice(0, 10),
              dawahx_url: `${SITE_URL}/videos.html?v=${encodeURIComponent(v.id)}`,
            }));
            const srcCards = topTexts.map((x, idx) => ({
              rank: idx + 1,
              key: x.k,
              title: x.t,
              clean_title: cleanTitleText(x.t),
              source_code: x.s,
              source_name: (rec.names && rec.names[x.s]) || SOURCE_NAMES[x.s] || x.s,
              category: (rec.names && rec.names[x.s]) || x.s,
              doc_type: 'article',
              pub_date: x.shown || x.d || '',
              dawahx_url: `${SITE_URL}/read.html?k=${x.k}`,
              share_url: `${SITE_URL}/s/${x.k}.html`,
              confidence: 1.0,
            }));
            return {
              status: 'conversational',
              is_chat: true,
              query: question,
              headline: '',
              direct_answer: 'আলহামদুলিল্লাহ! **DAWAH X**-এ সদ্য প্রকাশিত সাম্প্রতিক লেখা, ফতোয়া ও ভিডিওগুলো নিচে তুলে ধরা হলো:',
              explanation_paragraphs: ['যেকোনো লেখায় ক্লিক করে এখানেই সম্পূর্ণ পড়তে পারেন অথবা নিচের সাম্প্রতিক ভিডিওগুলো দেখতে পারেন।'],
              additional_perspectives: [],
              evidences: [],
              sources: srcCards,
              videos: topVids,
              follow_ups: topTexts.slice(0, 3).map((x) => summarizeLongHeadline(cleanTitleText(x.t))),
              confidence: 1.0,
              latency_ms: Math.max(1, Math.round(performance.now() - t0)),
              ask_team_url: `${SITE_URL}/ask.html`,
            };
          }
        } catch (_) {}
      }

      // Fast-path: respond instantaneously to natural everyday conversation while warming corpus index in background
      const chatReply = handleDialogueTurn(question, preDocs, preVids, history, t0);
      if (chatReply) {
        this.init().catch(() => {});
        return chatReply;
      }

      await this.init();
      const { query: contextualQuery, usedHistory } = augmentQueryWithHistory(question, history);

      // Stage 1: Linguistic expansion & Concept-Group shard retrieval
      const augQuery = translateBanglishAndEnglish(contextualQuery);
      const rawStems = [...new Set(tokenizeFolded(augQuery, true))];
      const coreStems = rawStems.filter(isCoreToken);

      // If the message contains ONLY conversational/pronoun/stop words (zero substantive subject words),
      // respond naturally as a conversational companion instead of matching random fatwas on stop words!
      if (!coreStems.length) {
        return {
          status: 'conversational',
          is_chat: true,
          query: question,
          headline: '',
          direct_answer: 'জি, আমি মনোযোগ দিয়ে শুনছি! 😊 আপনার মনে কী চলছে খুলে বলুন—চাইলে সাধারণ কথাবার্তা বলতে পারেন, অথবা কোনো ইসলামিক বিষয়ে জানতে চাইলে সেটিও জিজ্ঞেস করতে পারেন।',
          explanation_paragraphs: [],
          additional_perspectives: [],
          evidences: [],
          sources: [],
          videos: [],
          follow_ups: ['মন ভালো করার একটা উপদেশ দাও', 'একটা শিক্ষণীয় ঘটনা বলো', 'সালাতে মনোযোগ বাড়ানোর উপায় কী?'],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      const N = this.meta.n;
      const lenStr = this.titlesMeta.len || '';
      const conceptGroups = [];

      // Collect unique shard numbers needed in parallel first!
      const neededTShards = new Set();
      const neededBShards = new Set();

      for (const cs of coreStems) {
        const terms = new Set([cs]);
        if (SYNONYM_MAP.has(cs)) {
          for (const syn of SYNONYM_MAP.get(cs)) {
            terms.add(syn);
            terms.add(stemBn(syn));
          }
        }
        // For 2-codepoint stems (like হজ, রব), also probe common inflected prefix so shard prefix matches
        const probeTerms = new Set(terms);
        for (const t of terms) {
          if ([...t].length === 2) {
            probeTerms.add(t + 'ে');
            probeTerms.add(t + 'ের');
          }
        }
        for (const pt of probeTerms) {
          neededTShards.add(shardOf(pt, this.titlesMeta.shards));
          if ([...pt].length >= 3) {
            neededBShards.add(shardOf(pt, this.meta.shards));
          }
        }
        conceptGroups.push({ root: cs, terms, probeTerms, idf: 3.5 });
      }

      await Promise.all([
        ...[...neededTShards].map((i) => fetchWithFallback(`search/t${String(i).padStart(2, '0')}.json`)),
        ...[...neededBShards].map((i) => fetchWithFallback(`search/${String(i).padStart(3, '0')}.json`)),
      ]);

      const docScores = new Float32Array(N);
      const docMatchedIdf = new Float32Array(N);
      const docTitleMatchedIdf = new Float32Array(N);
      let totalCoreIdf = 0;

      for (const grp of conceptGroups) {
        const titleHits = new Set();
        const bodyHits = new Set();

        for (const pt of grp.probeTerms) {
          const tShard = await fetchWithFallback(`search/t${String(shardOf(pt, this.titlesMeta.shards)).padStart(2, '0')}.json`);
          for (const k in tShard) {
            const ks = stemBn(k);
            if (grp.terms.has(ks) || grp.terms.has(k) || ([...pt].length >= 4 && k.startsWith(pt))) {
              const ids = decodeIds(tShard[k]);
              for (let j = 0; j < ids.length; j++) titleHits.add(ids[j]);
            }
          }

          if ([...pt].length >= 3) {
            const bShard = await fetchWithFallback(`search/${String(shardOf(pt, this.meta.shards)).padStart(3, '0')}.json`);
            for (const k in bShard) {
              const ks = stemBn(k);
              if (grp.terms.has(ks) || grp.terms.has(k) || ([...pt].length >= 4 && k.startsWith(pt))) {
                const ids = decodeIds(bShard[k]);
                for (let j = 0; j < ids.length; j++) bodyHits.add(ids[j]);
              }
            }
          }
        }

        const unionCount = Math.max(titleHits.size, bodyHits.size);
        if (unionCount === 0) {
          // Unknown/unmatched token in DAWAH X still contributes to denominator so OOD queries drop in coverage!
          grp.idf = 5.5;
          totalCoreIdf += grp.idf;
          continue;
        }

        const idf = Math.log(1 + (N - unionCount + 0.5) / (unionCount + 0.5));
        grp.idf = Math.max(0.8, idf);
        totalCoreIdf += grp.idf;

        for (const id of titleHits) {
          const tLenIdx = LEN_CHARS.indexOf(lenStr[id] || 'H');
          const dl = tLenIdx >= 0 ? Math.max(tLenIdx, 2) : 8;
          const bm25Norm = 1.0 / (0.55 + 0.45 * (dl / 9.0));
          docScores[id] += grp.idf * 3.6 * bm25Norm;
          docTitleMatchedIdf[id] += grp.idf;
          docMatchedIdf[id] += grp.idf;
        }
        for (const id of bodyHits) {
          docScores[id] += grp.idf * 1.18;
          if (!titleHits.has(id)) {
            docMatchedIdf[id] += grp.idf * 0.85;
          }
        }
      }

      totalCoreIdf = Math.max(totalCoreIdf, 1.0);

      // Collect top Stage-1 candidates (plus highest full-body-coverage treatises!)
      const stage1 = [];
      const bodyCompletePool = [];
      for (let id = 0; id < N; id++) {
        if (docScores[id] <= 0.1) continue;
        // Quick side bit pre-filter when fatwa/dawah filter requested
        if (sourceFilter === 'dawah') {
          const isFatwaSide = ((this.sideBytes[id >> 3] || 0) >> (id & 7)) & 1;
          if (isFatwaSide === 1) continue; // exclude 'at' & 'ai'
        }
        const cov = Math.min(1.0, docMatchedIdf[id] / totalCoreIdf);
        if (cov < 0.22) continue;
        const titleCov = Math.min(1.0, docTitleMatchedIdf[id] / totalCoreIdf);
        const fullBodyBonus = cov >= 0.82 ? 1.18 : 1.0;
        const composite = docScores[id] * (0.34 + 0.48 * cov + 0.18 * titleCov) * fullBodyBonus;
        const entry = [id, composite, cov, titleCov];
        stage1.push(entry);
        if (cov >= 0.80 && titleCov < 0.50) bodyCompletePool.push(entry);
      }

      stage1.sort((a, b) => b[1] - a[1]);
      bodyCompletePool.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
      const topStage1 = stage1.slice(0, 24);
      const pickedIds = new Set(topStage1.map((x) => x[0]));
      for (const bc of bodyCompletePool.slice(0, 6)) {
        if (!pickedIds.has(bc[0])) {
          topStage1.push(bc);
          pickedIds.add(bc[0]);
        }
      }

      if (!topStage1.length) {
        return this._notFoundPayload(question, [], [], t0);
      }

      // Inject any matching Canonical Master Doctrine keys so comprehensive treatises are never missed!
      const canonicalBoostKeys = new Set();
      for (const route of CANONICAL_DOCTRINE_ROUTES) {
        if (route.re.test(augQuery) && !route.guardNo.test(augQuery)) {
          for (const rk of route.keys) canonicalBoostKeys.add(rk);
        }
      }

      // Fetch full DAWAH X bucket records for top candidates + canonical routes in parallel
      const candKeys = topStage1.map(([id]) => this.keys.slice(id * 14, id * 14 + 14));
      for (const ck of canonicalBoostKeys) {
        if (!candKeys.includes(ck)) {
          candKeys.push(ck);
          topStage1.push([-1, (topStage1[0]?.[1] || 10.0) * 0.92, 0.92, 0.85]);
        }
      }
      const uniqueBuckets = [...new Set(candKeys.map((k) => k.slice(-3)))];
      const bucketObjs = {};
      await Promise.all(
        uniqueBuckets.map(async (b3) => {
          bucketObjs[b3] = await fetchWithFallback(`texts/${b3}.json`);
        })
      );

      // Stage 2: Full-Text Passage-Window Reranking, Mandatory Anchor Guard & Curated Graph Calibration
      const sortedGroups = [...conceptGroups].sort((a, b) => b.idf - a.idf);
      const topSubjectTerms = sortedGroups[0] ? sortedGroups[0].terms : new Set();
      const mandatoryGroups = conceptGroups.filter((g) => {
        for (const t of g.terms) if (MANDATORY_ANCHOR_STEMS.has(t)) return true;
        return false;
      });
      const queryHasOtherRel = OTHER_RELIGION_RE.test(question);
      const queryHasNegException = /(?:না\s*মেনে|ছাড়া\s*পড়লে|সন্দেহ|৪১\s*দিন|ভুলে\s*গেলে)/u.test(question);
      const queryHasPhysicalInjury = /(?:হাত|পা|ব্যান্ডেজ|প্লাস্টার|ক্ষত|যখম)/u.test(question);
      const queryHasNarrowTrigger = /(?:উট|গোশত|কৃমি|ধূমপান|দুধ|হাঁটু|পেঁয়াজ|রসুন|ছানা|জুতা|হিজড়া|মুনাজাত)/u.test(question);

      const reranked = [];
      const seenTitles = new Set();
      const maxS1 = topStage1[0][1] || 1.0;

      for (let idx = 0; idx < topStage1.length; idx++) {
        const [id, s1Score, rawCov, rawTitleCov] = topStage1[idx];
        const key = candKeys[idx];
        const raw = bucketObjs[key.slice(-3)]?.[key];
        if (!raw) continue;

        const doc = parseDocRecord(key, raw);

        // Apply exact sourceFilter
        if (sourceFilter === 'fatwa' && !(doc.doc_type === 'fatwa' || ['at', 'ai', 'ik'].includes(doc.source_code))) continue;
        if (sourceFilter === 'dawah' && !['fm', 'ra', 'iz', 'ia'].includes(doc.source_code)) continue;
        if (sourceFilter === 'article' && doc.doc_type !== 'article') continue;
        if (['at', 'ai', 'ik', 'fm', 'ra', 'iz', 'ia'].includes(sourceFilter) && doc.source_code !== sourceFilter) continue;

        const ft = foldBn(doc.clean_title);
        if (seenTitles.has(ft)) continue;
        seenTitles.add(ft);

        // Scan entire document for highest-density passage/section window!
        const winInfo = findBestSectionWindow(doc, conceptGroups, totalCoreIdf);
        doc.best_window_idx = winInfo.bestIdx;
        doc.best_window_cov = winInfo.windowCov;
        doc.best_window_heading = winInfo.isSubheadingMatch;

        const cov = Math.max(rawCov, winInfo.windowCov * 0.94);
        const titleCov = winInfo.isSubheadingMatch ? Math.max(rawTitleCov, winInfo.windowCov * 0.85) : rawTitleCov;

        const winSlice = doc.paragraphs.slice(winInfo.bestIdx, winInfo.bestIdx + 3).join(' ');
        const fullDocToks = new Set(
          tokenizeFolded(`${doc.clean_title} ${doc.question_context} ${doc.opening_ruling} ${winSlice}`, true)
        );
        const titleTokList = tokenizeFolded(doc.clean_title, true);

        let topSubjHit = 0;
        for (const st of topSubjectTerms) {
          if (fullDocToks.has(st)) { topSubjHit = 1; break; }
        }

        // Mandatory subject-anchor guard (e.g., জানাযা, তাহাজ্জুদ, দাড়ি, আয়েশা, ওযু must appear!)
        let missingAnchorPenalty = 0.0;
        if (mandatoryGroups.length > 0) {
          let missingAnchors = 0;
          for (const mg of mandatoryGroups) {
            let hit = false;
            for (const t of mg.terms) {
              if (fullDocToks.has(t)) { hit = true; break; }
            }
            if (!hit) missingAnchors++;
          }
          if (missingAnchors > 0) {
            missingAnchorPenalty = -0.26 * (missingAnchors / mandatoryGroups.length);
          }
        }

        // Adjacent query bigram proximity bonus in title
        let bigramBonus = 0;
        if (coreStems.length >= 2 && titleTokList.length >= 2) {
          let hits = 0;
          for (let bi = 0; bi < coreStems.length - 1; bi++) {
            const g1 = conceptGroups[bi].terms;
            const g2 = conceptGroups[bi + 1].terms;
            const p1 = titleTokList.findIndex((t) => g1.has(t));
            const p2 = titleTokList.findIndex((t) => g2.has(t));
            if (p1 >= 0 && p2 >= 0 && Math.abs(p1 - p2) <= 3) hits++;
          }
          bigramBonus = hits / (coreStems.length - 1);
        }

        const isQaBonus = ['fatwa', 'qa', 'rebuttal'].includes(doc.doc_type) ? 0.05 : 0.0;
        const dalilBonus = doc.evidences.length >= 1 && doc.answer_body.length >= 200 ? 0.05 : 0.0;
        const curatedBonus = (CURATED_TOPIC_KEYS.has(key) && cov >= 0.45 ? 0.11 : 0.0) + (canonicalBoostKeys.has(key) ? 0.18 : 0.0);

        // Guard 1: Penalize ultra-short URL-only stubs, student poems, and secular accident/mineral news briefs
        const isThinStub =
          doc.answer_body.length < 115 ||
          (doc.answer_body.length < 190 && /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(doc.answer_body));
        const isPoemOrNews = POEM_OR_NEWS_RE.test(`${doc.clean_title} ${doc.answer_body.slice(0, 500)}`);
        const stubPenalty = (isThinStub ? -0.19 : 0.0) + (isPoemOrNews ? -0.28 : 0.0);

        // Guard 2: Penalize comparative-religion titles ("হিন্দু ধর্মে...") when user asked about Islam
        const otherRelPenalty = !queryHasOtherRel && OTHER_RELIGION_RE.test(doc.clean_title) ? -0.26 : 0.0;

        // Guard 3: Prefer direct canonical questions over narrow negated/conditional/injury scenarios
        let specificityAdj = 0.0;
        if (!queryHasNegException && /(?:না\s*মেনে|৪১\s*দিন|সন্দেহ\s*হলে)/u.test(doc.clean_title)) {
          specificityAdj -= 0.11;
        }
        if (!queryHasPhysicalInjury && /(?:হাত-পা\s*ভাঙ্গার|ব্যান্ডেজ)/u.test(doc.clean_title)) {
          specificityAdj -= 0.22;
        }
        if (!queryHasNarrowTrigger && /(?:উটের\s*গোশত|কৃমি\s*বের|ধূমপান\s*করলে|দুধ\s*পান|হাঁটুর\s*উপরে|ছানা\s*পড়া|জুতা\s*পরে|হিজড়া|সম্মিলিতভাবে\s*মুনাজাত)/u.test(doc.clean_title)) {
          specificityAdj -= 0.19;
        }
        if (winInfo.isSubheadingMatch && winInfo.windowCov >= 0.85) {
          specificityAdj += 0.14;
        }
        if (doc.clean_title.length <= 95 && titleCov >= 0.65) {
          specificityAdj += 0.04;
        } else if (doc.clean_title.length > 260) {
          specificityAdj -= 0.04;
        }

        const normS1 = s1Score / maxS1;
        let conf =
          0.32 * cov +
          0.23 * titleCov +
          0.19 * normS1 +
          0.10 * topSubjHit +
          0.06 * bigramBonus +
          isQaBonus +
          dalilBonus +
          curatedBonus +
          stubPenalty +
          otherRelPenalty +
          missingAnchorPenalty +
          specificityAdj;

        if (cov < 0.30 && topSubjHit === 0) conf *= 0.35;
        conf = Math.min(0.98, Math.max(0.02, conf));

        doc.confidence = Number(conf.toFixed(4));
        doc.core_coverage = Number(cov.toFixed(3));
        reranked.push(doc);
      }

      reranked.sort((a, b) => b.confidence - a.confidence);
      const [videos, seriesIdx] = await Promise.all([
        this.searchVideos(conceptGroups, 4),
        this.getSeriesIndex(),
      ]);

      if (!reranked.length || reranked[0].confidence < 0.26 || reranked[0].core_coverage < 0.25) {
        return this._notFoundPayload(question, reranked.slice(0, 3), videos, t0);
      }

      // Synthesize Grounded Answer from Top DAWAH X Documents
      const primary = reranked[0];
      let proseDoc = primary;
      if (
        primary.answer_body.length < 180 &&
        reranked.length > 1 &&
        reranked[1].confidence >= 0.32 &&
        reranked[1].answer_body.length >= 200
      ) {
        proseDoc = reranked[1];
      }

      // Fetch DAWAH X precomputed semantic neighbor graph (`rel/<hex2>.json`) for primary document
      let relNeighbors = [];
      try {
        const relShard = await fetchWithFallback(`rel/${primary.key.slice(-2)}.json`);
        const relEntry = relShard && relShard[primary.key];
        if (Array.isArray(relEntry) && typeof relEntry[2] === 'string' && relEntry[2].length >= 14) {
          const packed = relEntry[2];
          const rKeys = [];
          for (let p = 0; p + 14 <= packed.length; p += 14) {
            rKeys.push(packed.slice(p, p + 14));
          }
          // Look up neighbor titles from their own rel shards (cached/lightweight) or already fetched buckets
          const relShardsNeeded = [...new Set(rKeys.slice(0, 3).map((rk) => rk.slice(-2)))];
          const relMap = {};
          await Promise.all(
            relShardsNeeded.map(async (h2) => {
              relMap[h2] = await fetchWithFallback(`rel/${h2}.json`).catch(() => null);
            })
          );
          for (const rk of rKeys.slice(0, 3)) {
            const info = relMap[rk.slice(-2)]?.[rk];
            if (Array.isArray(info) && info[0]) {
              relNeighbors.push({
                key: rk,
                clean_title: cleanTitleText(info[0]).replace(/…$/, ''),
                category: info[1] || '',
              });
            }
          }
        }
      } catch (_) {}

      // Check if primary document belongs to a multi-part DAWAH X series (`series.json`)
      let seriesInfo = null;
      if (seriesIdx && seriesIdx.m && seriesIdx.m[primary.key]) {
        const [sIdx, pIdx] = seriesIdx.m[primary.key];
        const ser = seriesIdx.s?.[sIdx];
        if (ser && Array.isArray(ser.p)) {
          seriesInfo = {
            id: ser.id,
            title: ser.t,
            current_part_index: pIdx,
            series_url: `${SITE_URL}/series-${ser.id}.html`,
            parts: ser.p.slice(0, 8).map(([pk, pt, pno], idx) => ({
              key: pk,
              title: pt,
              part_no: pno,
              is_current: idx === pIdx,
              dawahx_url: `${SITE_URL}/read.html?k=${pk}`,
            })),
          };
        }
      }

      const coreSet = new Set(coreStems);
      const expSet = new Set();
      conceptGroups.forEach((g) => g.terms.forEach((t) => expSet.add(t)));

      const selectedParas = selectBestParagraphs(proseDoc, coreSet, expSet, 4, 1500);
      const directAnswer = selectedParas[0] || trimCleanly(proseDoc.opening_ruling, 500);
      const explanationParas = selectedParas.slice(1);

      const additionalPerspectives = [];
      for (const sec of reranked.slice(1, 4)) {
        if (sec === proseDoc) continue;
        if (sec.confidence >= Math.max(0.36, primary.confidence * 0.6) && sec.core_coverage >= 0.45) {
          const sp = selectBestParagraphs(sec, coreSet, expSet, 1, 360);
          if (sp.length) {
            additionalPerspectives.push({
              key: sec.key,
              title: sec.clean_title,
              source_name: sec.source_name,
              dawahx_url: sec.dawahx_url,
              summary: trimCleanly(sp[0], 340),
            });
          }
        }
        if (additionalPerspectives.length >= 2) break;
      }

      const evidences = [];
      const seenEv = new Set();
      for (const d of [proseDoc, ...reranked.slice(0, 2)]) {
        for (const ev of d.evidences) {
          const k = ev.slice(0, 65);
          if (!seenEv.has(k)) {
            seenEv.add(k);
            evidences.push({
              text: ev,
              source_title: d.clean_title,
              source_name: d.source_name,
              dawahx_url: d.dawahx_url,
            });
          }
          if (evidences.length >= 5) break;
        }
        if (evidences.length >= 5) break;
      }

      const citedDocs = [primary];
      if (proseDoc !== primary) citedDocs.push(proseDoc);
      for (const c of reranked.slice(1, topK + 1)) {
        if (!citedDocs.includes(c) && c.confidence >= Math.max(0.25, primary.confidence * 0.42)) {
          citedDocs.push(c);
        }
      }

      const sourcesPayload = citedDocs.slice(0, 5).map((c, i) => ({
        rank: i + 1,
        key: c.key,
        title: c.title,
        clean_title: c.clean_title,
        source_code: c.source_code,
        source_name: c.source_name,
        category: c.category,
        doc_type: c.doc_type,
        author: c.author,
        pub_date: c.pub_date,
        dawahx_url: c.dawahx_url,
        share_url: c.share_url,
        orig_url: c.orig_url,
        confidence: c.confidence,
        excerpt: trimCleanly(c.opening_ruling, 220),
      }));

      const followUps = [];
      for (const c of reranked.slice(1, 7)) {
        const shortT = summarizeLongHeadline(c.clean_title);
        if (shortT.length >= 12 && shortT.length <= 135 && shortT !== summarizeLongHeadline(primary.clean_title) && !followUps.includes(shortT)) {
          followUps.push(shortT);
        }
        if (followUps.length >= 3) break;
      }
      for (const rn of relNeighbors) {
        if (rn.clean_title.length >= 14 && rn.clean_title.length <= 125 && !followUps.includes(rn.clean_title)) {
          followUps.push(rn.clean_title);
        }
        if (followUps.length >= 5) break;
      }

      const ragContext = citedDocs.slice(0, 3).map((c, i) => ({
        citation: `[${i + 1}] ${c.title} (${c.source_name}) — ${c.dawahx_url}`,
        content: trimCleanly(c.answer_body, 1200),
      }));

      const conversationalIntro = buildConversationalOpening(
        question,
        proseDoc.doc_type,
        proseDoc.source_name,
        usedHistory
      );

      const displayHeadline = summarizeLongHeadline(proseDoc.clean_title);
      const readerScenario = proseDoc.clean_title.length > 180 ? proseDoc.clean_title : (proseDoc.question_context || '');

      return {
        status: 'answered',
        is_chat: false,
        query: question,
        conversational_intro: conversationalIntro,
        headline: displayHeadline,
        reader_scenario: readerScenario,
        series_info: seriesInfo,
        primary_source: proseDoc.source_code,
        primary_source_code: proseDoc.source_code,
        primary_source_name: proseDoc.source_name,
        primary_doc_type: proseDoc.doc_type,
        primary_key: proseDoc.key,
        primary_url: proseDoc.dawahx_url,
        share_url: proseDoc.share_url,
        direct_answer: directAnswer,
        explanation_paragraphs: explanationParas,
        extra_body: trimCleanly(proseDoc.answer_body, 2600),
        additional_perspectives: additionalPerspectives,
        evidences,
        sources: sourcesPayload,
        videos: videos.slice(0, 4),
        follow_ups: followUps,
        rag_context: ragContext,
        confidence: primary.confidence,
        latency_ms: Math.round(performance.now() - t0),
        ask_team_url: `${SITE_URL}/ask.html`,
      };
    },

    _notFoundPayload(question, partialDocs, videos, t0) {
      const validPartials = partialDocs.filter((c) => c.confidence >= 0.16);
      return {
        status: 'not_found',
        is_chat: true,
        query: question,
        headline: '',
        direct_answer:
          'আপনার কথাটির জন্য ধন্যবাদ! আমি আপনার সাথে স্বাভাবিকভাবে যেকোনো বিষয়ে কথাবার্তা বলতে পারি; তবে কোনো নির্দিষ্ট মাসআলা বা তথ্যগত প্রশ্নের ক্ষেত্রে আমি শুধুমাত্র **DAWAH X**-এর যাচাইকৃত সংগ্রহ থেকেই উত্তর দিই—যাতে কখনো মনগড়া বা ভুল ফতোয়া চলে না যায়।',
        explanation_paragraphs: [
          'এই নির্দিষ্ট প্রশ্নটির সরাসরি উত্তর DAWAH X-এর বর্তমান সংগ্রহে খুঁজে পাওয়া যায়নি। আপনি চাইলে প্রশ্নটি একটু ভিন্নভাবে লিখতে পারেন, নিচের বাটনে ক্লিক করে সরাসরি **DAWAH X টিমে** পাঠাতে পারেন, অথবা আমার সাথে অন্য যেকোনো বিষয়ে আলাপ চালিয়ে যেতে পারেন!',
        ],
        additional_perspectives: [],
        evidences: [],
        sources: validPartials.map((s, i) => ({
          rank: i + 1,
          key: s.key,
          title: s.title,
          clean_title: s.clean_title,
          source_name: s.source_name,
          category: s.category,
          doc_type: s.doc_type,
          author: s.author,
          pub_date: s.pub_date,
          dawahx_url: s.dawahx_url,
          orig_url: s.orig_url,
          confidence: s.confidence,
        })),
        videos: validPartials.length ? videos.slice(0, 2) : [],
        follow_ups: [
          'কুরআন ও সুন্নাহর আলোকে তাওহীদের গুরুত্ব কী?',
          'সালাত আদায়ের সহীহ নিয়ম কী?',
          'আল্লাহর রহমত ও তওবা কবুলের শর্ত কী?',
        ],
        confidence: validPartials[0] ? validPartials[0].confidence : 0,
        latency_ms: Math.round(performance.now() - t0),
        ask_team_url: `${SITE_URL}/ask.html`,
      };
    },
  };

  root.DawahXBrowserAI = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
