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
    [/শবে\s*কদর|শবেকদর/gu, 'শবে কদর লাইলাতুল কদর'],
    [/বদ\s*নজর|বদ\s*নযর|বদনজর/gu, 'বদনযর নযর রুকইয়াহ'],
    [/রক্তদান/gu, 'রক্ত দান রোগীকে'],
    [/অঙ্গদান/gu, 'অঙ্গ দান প্রতিস্থাপন'],
    [/ঈদুলফিতর/gu, 'ঈদুল ফিতর'],
    [/ঈদুলআযহা|ঈদুলআজহা/gu, 'ঈদুল আযহা'],
    [/আয়াতুলকুরসী|আয়াতুলকুরসি/gu, 'আয়াতুল কুরসী'],
    [/সিজদায়েসাহু|সিজদায়ে\s*সাহু/gu, 'সাহু সিজদা'],
    [/(?<=\s|^)[6৬](?=\s*(?:টি\s*)?(?:রোজা|রোযা|সিয়াম|ছিয়াম))/gu, 'ছয়টি'],
    [/(?<=\s|^)[7৭](?=\s*ভাগে)/gu, 'সাত'],
    [/(?<=\s|^)[3৩](?=\s*তালাক)/gu, 'তিন'],
  ];

  const BANGLISH_CLIENT_MAP = [
    [/\bayatul\s*kursi\b/gi, 'আয়াতুল কুরসী'],
    [/\bsahu\s*sijda[h]?\b|\bsijda(?:ye)?\s*sahu\b/gi, 'সাহু সিজদা'],
    [/\bforoj\s*gosol(?:er)?\b|\bfarz\s*ghusl\b|\bgosol(?:er)?\b/gi, 'ফরয গোসল'],
    [/\boju\s*vangar\b|\bozu\s*bhangar\b|\bwudu\b|\boju\b|\bozu\b/gi, 'ওযু ভঙ্গ'],
    [/\btayammum\b/gi, 'তায়াম্মুম'],
    [/\bnamaj(?:e|er)?\b|\bnamaz(?:e|er)?\b|\bsalat(?:e|er)?\b/gi, 'সালাত নামাজ'],
    [/\bhat\b/gi, 'হাত'],
    [/\bbuk(?:er)?\b/gi, 'বুকের'],
    [/\bnavi(?:r)?\b|\bnabhi(?:r)?\b/gi, 'নাভির'],
    [/\bbadh(?:bo|be|a)?\b/gi, 'বাঁধা'],
    [/\broja(?:r)?\b|\broza(?:r)?\b|\bsiam\b|\bsiyam\b/gi, 'রোজা সিয়াম'],
    [/\bvangar\b|\bbhangar\b|\bvange\b/gi, 'ভাঙ্গার ভঙ্গ'],
    [/\bzakat(?:er)?\b|\bjakat(?:er)?\b/gi, 'যাকাত'],
    [/\bfitra[h]?\b/gi, 'ফিতরা'],
    [/\bqurbani\b|\bkurbani\b/gi, 'কুরবানী'],
    [/\bakika[h]?\b|\baqiqa[h]?\b/gi, 'আকীকা'],
    [/\bjanaja(?:r)?\b|\bjanaza(?:r)?\b/gi, 'জানাযা'],
    [/\btahajjud(?:er)?\b/gi, 'তাহাজ্জুদ'],
    [/\btarabi[h]?\b|\btaraweeh\b/gi, 'তারাবীহ'],
    [/\bwitr\b|\bbitor(?:er)?\b|\bbitr\b/gi, 'বিতর'],
    [/\bistikhara(?:r)?\b|\bistekhara(?:r)?\b/gi, 'ইস্তিখারা'],
    [/\bdua\b|\bdoa\b/gi, 'দোয়া দুআ'],
    [/\bghumanor\b/gi, 'ঘুমানোর'],
    [/\btalak\b|\btalaq\b/gi, 'তালাক'],
    [/\bsud(?:er)?\b|\briba\b/gi, 'সুদ রিবা'],
    [/\bbkash\b/gi, 'বিকাশ'],
    [/\bnagad\b/gi, 'নগদ'],
    [/\bcashback\b/gi, 'ক্যাশব্যাক'],
    [/\bporda(?:r)?\b|\bhijab\b/gi, 'পর্দা হিজাব'],
    [/\bdari\b|\bbeard\b/gi, 'দাড়ি'],
    [/\btawba[h]?\b|\btauba[h]?\b/gi, 'তাওবা'],
    [/\bshirk\b/gi, 'শিরক'],
    [/\bbidat\b|\bbidah\b/gi, 'বিদআত'],
    [/\bkoto\s*rakat\b/gi, 'কত রাকআত'],
    [/\bniyom\b|\bpoddhoti\b/gi, 'নিয়ম পদ্ধতি'],
    [/\bkaron\b/gi, 'কারণ'],
    [/\bhalal\b/gi, 'হালাল জায়েয'],
    [/\bharam\b/gi, 'হারাম নাজায়েয'],
  ];

  function expandCompoundsBn(text) {
    let s = String(text || '');
    if (/[a-zA-Z]/.test(s)) {
      for (const [re, bn] of BANGLISH_CLIENT_MAP) {
        s = s.replace(re, bn);
      }
    }
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
    ['কবর', 'কবরে'],
    ['মাজার', 'মাযার'],
    ['যিয়ারত', 'জিয়ারত'],
    ['সুদ', 'রিবা'],
    ['ভ্যাট', 'ট্যাক্স', 'আয়কর'],
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
    ['মনোযোগ', 'খুশু', 'খুযু', 'একাগ্রতা'],
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
    ['বিষন্নতা', 'হতাশা', 'দুশ্চিন্তা', 'অশান্তি', 'ডিপ্রেশন'],
    ['বিবর্তনবাদ', 'ডারউইনবাদ', 'ডারউইন'],
    ['আত্মহত্যা', 'সুইসাইড'],
    ['ভুল', 'ভুলে', 'ভুলক্রমে'],
    ['সাহু', 'সাহু-সিজদা'],
    ['কসর', 'ক্বছর', 'মুসাফির'],
    ['মোজা', 'মোযা', 'মাসাহ'],
    ['আশুরা', 'আশূরা', 'মুহাররম', 'মহররম'],
    ['গর্ভপাত', 'অ্যাবরশন', 'এবরশন', 'এ্যাবোরশন', 'ভ্রূণ'],
    ['টুথপেস্ট', 'টুথপেষ্ট', 'ব্রাশ', 'মিসওয়াক'],
    ['কুলখানী', 'চল্লিশা', 'মৃত্যুবার্ষিকী'],
    ['দত্তক', 'পালক'],
    ['ইস্তেখারা', 'ইস্তিখারা', 'ইস্তেখারাহ'],
    ['মোহরানা', 'মোহর', 'মহরানা', 'দেনমোহর'],
    ['কিস্তি', 'কিস্তিতে', 'বাকীতে', 'বাকিতে'],
    ['লটারি', 'লটারী', 'প্রাইজবন্ড', 'জুয়া'],
    ['শবেবরাত', 'শবে-বরাত', 'শাবান'],
    ['বিপদ', 'কষ্ট', 'মুসিবত', 'পরীক্ষা'],
    ['ঘুমানো', 'ঘুম', 'শোয়া', 'নিদ্রা'],
    ['বাড়ানো', 'বৃদ্ধি', 'অর্জন'],
    ['সুন্নাহসম্মত', 'শরীয়তসম্মত', 'শারঈ', 'সুন্নাতী'],
    ['সময়সীমা', 'মেয়াদ', 'সময়'],
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
    foroj: 'ফরয ফরজ', farz: 'ফরয ফরজ', fard: 'ফরয ফরজ', wajib: 'ওয়াজিব ফরয', makruh: 'মাকরূহ',
    karon: 'কারণ ভঙ্গ শর্ত', venge: 'ভঙ্গ ভেঙে নষ্ট', bhenge: 'ভঙ্গ ভেঙে নষ্ট', nosto: 'নষ্ট ভঙ্গ',
    sothik: 'সঠিক সহীহ সুন্নাহ', sahih: 'সহীহ বিশুদ্ধ হাদীস', daif: 'যঈফ দুর্বল হাদীস',
    injection: 'ইনজেকশন স্যালাইন ছিয়াম', saline: 'স্যালাইন ইনজেকশন ছিয়াম', medicine: 'ঔষধ চিকিৎসা রোজা',
    // v5.0 Expanded Everyday Banglish & Medical/Fiqh Terms
    vul: 'ভুল সাহু সিজদা', bhul: 'ভুল সাহু সিজদা', mistake: 'ভুল সাহু সিজদা', forget: 'ভুলে সাহু সিজদা',
    sofor: 'সফর মুসাফির ক্বছর', safar: 'সফর মুসাফির ক্বছর', travel: 'সফর ক্বছর',
    kosor: 'ক্বছর কসর ছালাত', kasar: 'ক্বছর কসর ছালাত', qasr: 'ক্বছর কসর ছালাত',
    istikhara: 'ইস্তেখারাহ ইস্তেখারা ছালাত', istekhara: 'ইস্তেখারাহ ইস্তেখারা ছালাত',
    masbuk: 'মাসবূক জামাআত ছালাত', eid: 'ঈদ ছালাত তাকবীর',
    moja: 'মোযা মাসাহ ওযূ', masah: 'মাসাহ মোযা ওযূ', socks: 'মোযা মাসাহ',
    toothpaste: 'টুথপেষ্ট ব্রাশ ছিয়াম', paste: 'টুথপেষ্ট ব্রাশ ছিয়াম', brush: 'ব্রাশ টুথপেষ্ট মিসওয়াক', miswak: 'মিসওয়াক ব্রাশ',
    vag: 'ভাগে শরীক পশুতে', bhag: 'ভাগে শরীক পশুতে', goru: 'গরু পশুতে সাত ভাগে', chagol: 'ছাগল পশু কুরবানী',
    bidaat: 'বিদআত সুন্নাত', bidah: 'বিদআত সুন্নাত', amol: 'আমল সুন্নাত',
    bod: 'বদনযর নযর', nojor: 'বদনযর নযর রুকইয়াহ', nazar: 'বদনযর নযর রুকইয়াহ',
    bacha: 'রক্ষা প্রতিকার বাঁচার', bachar: 'রক্ষা প্রতিকার বাঁচার',
    blood: 'রক্ত রোগীকে দান', rokto: 'রক্ত রক্তদান', donation: 'দান রক্ত প্রতিস্থাপন', donate: 'দান রক্ত',
    organ: 'অঙ্গ প্রতিস্থাপন দান', abortion: 'গর্ভপাত ভ্রূণ', gorvopat: 'গর্ভপাত ভ্রূণ',
    kodor: 'লাইলাতুল কদর রামাযান', qadr: 'লাইলাতুল কদর রামাযান', ashura: 'আশূরা মুহাররম ছিয়াম',
    shawwal: 'শাওয়াল ছয়টি ছিয়াম', arafah: 'আরাফা ছিয়াম', arafa: 'আরাফা ছিয়াম',
    kulkhani: 'কুলখানী চল্লিশা বিদআত', chollisha: 'চল্লিশা কুলখানী বিদআত',
    dottok: 'দত্তক পালক সন্তান', adoption: 'দত্তক পালক সন্তান',
    jinn: 'জিন শয়তান রুকইয়াহ', jin: 'জিন শয়তান রুকইয়াহ', nonmuslim: 'অমুসলিম বিধর্মী',
    // Salah posture & etiquette Banglish terms
    buk: 'বুক বুকের', buke: 'বুক বুকের', chest: 'বুক বুকের',
    nabhi: 'নাভি নাভীর', navi: 'নাভি নাভীর', navel: 'নাভি নাভীর',
    hat: 'হাত', haat: 'হাত', hand: 'হাত', hands: 'হাত',
    badha: 'বাঁধা বাঁধার', bandha: 'বাঁধা বাঁধার', badhbo: 'বাঁধা বাঁধার', badhbe: 'বাঁধা বাঁধার',
    raful: 'রাফউল ইয়াদাইন', yadain: 'রাফউল ইয়াদাইন', rafayadain: 'রাফউল ইয়াদাইন',
    amin: 'আমীন', ameen: 'আমীন', fatiha: 'ফাতিহা সূরা', sana: 'ছানা সানা',
    attahiyatu: 'আত্তাহিয়্যাতু তাশাহহুদ', darood: 'দরূদ সালাত', durood: 'দরূদ সালাত',
    sutra: 'সুতরা ছালাত', mobile: 'মোবাইল ছালাত',
    // v22.0 Expanded Banglish, Scripture, Hadith & Books Vocabulary
    monojog: 'মনোযোগ একাগ্রতা খুশু', ekagrota: 'একাগ্রতা মনোযোগ খুশু',
    barano: 'বাড়ানো অর্জনের উপায়', baranor: 'বাড়ানোর অর্জনের উপায়', barabo: 'বাড়াবো অর্জনের উপায়',
    niyom: 'নিয়ম পদ্ধতি', poddhoti: 'পদ্ধতি নিয়ম', hukum: 'হুকুম বিধান', bidhan: 'বিধান হুকুম',
    ghum: 'ঘুম ঘুমানোর শোয়া', ghumano: 'ঘুমানো ঘুম শোয়া', ghumanor: 'ঘুমানোর শোয়ার', sleep: 'ঘুম ঘুমানোর শোয়া',
    sokal: 'সকাল সন্ধ্যার', shokal: 'সকাল সন্ধ্যার', sondha: 'সন্ধ্যা সন্ধ্যার', shondha: 'সন্ধ্যা সন্ধ্যার',
    morning: 'সকাল সন্ধ্যার', evening: 'সন্ধ্যা সকাল',
    kosto: 'কষ্ট বিপদ পরীক্ষা', bipod: 'বিপদ কষ্ট পরীক্ষা', porikkha: 'পরীক্ষা কষ্ট তাকদীর',
    boi: 'বই কিতাব গ্রন্থ', book: 'বই কিতাব গ্রন্থ', books: 'বই কিতাব গ্রন্থসমূহ', pdf: 'পিডিএফ বই',
    tafsir: 'তাফসীর ব্যাখ্যা', tafseer: 'তাফসীর ব্যাখ্যা',
    ibnkathir: 'তাফসীর ইবনে কাসীর', kathir: 'ইবনে কাসীর তাফসীর', kasir: 'ইবনে কাসীর তাফসীর',
    jalalain: 'তাফসীরে জালালাইন', maarif: 'তাফসীরে মাআরেফুল কুরআন', maariful: 'মাআরেফুল কুরআন',
    tabari: 'তাফসীরে তাবারী', mazhari: 'তাফসীরে মাযহারী', usmani: 'তাফসীরে উসমানী',
    zilal: 'তাফসীর ফি যিলালিল কুরআন', tawjih: 'তাফসীরে তাওযীহুল কুরআন', bidaya: 'আল বিদায়া ওয়ান নিহায়া',
    bukhari: 'সহীহ বুখারী হাদীস', muslim_hadith: 'সহীহ মুসলিম হাদীস', tirmidhi: 'তিরমিজি হাদীস', tirmizi: 'তিরমিজি হাদীস',
    abudawud: 'আবু দাউদ হাদীস', nasai: 'নাসাঈ হাদীস', ibnmajah: 'ইবনে মাজাহ হাদীস', mishkat: 'মিশকাত হাদীস',
    riyadus: 'রিয়াদুস সালেহীন হাদীস', salihin: 'রিয়াদুস সালেহীন হাদীস', bulugul: 'বুলুগুল মারাম হাদীস',
    nawawi: 'নববীর চল্লিশ হাদীস', qudsi: 'হাদীসে কুদসী', muwatta: 'মুয়াত্তা ইমাম মালিক', adabul: 'আদাবুল মুফরাদ', shamail: 'শামায়েলে তিরমিযি',
    ikhlas: 'সূরা ইখলাস', falaq: 'সূরা ফালাক', nas: 'সূরা নাস', baqarah: 'সূরা বাকারা', baqara: 'সূরা বাকারা',
    bakara: 'সূরা বাকারা', hashr: 'সূরা হাশর', rahman: 'সূরা আর-রহমান', waqiah: 'সূরা ওয়াকিয়াহ',
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
    'bose', 'boshe', 'utha', 'uthte', 'shona', 'shunle', 'dekha', 'dekhle', 'rakha', 'rakhle', 'rekhe',
    'use', 'using', 'used', 'vyabohar', 'babohar', 'din', 'dine', 'somoy',
    'na', 'nai', 'noy', 'naki', 'ba', 'othoba', 'ebong', 'ar', 'kintu', 'tobe', 'jodi', 'tahole', 'taile',
    'jonno', 'jonyo', 'theke', 'sathe', 'songe', 'moddhe', 'vitor', 'vitore', 'upor', 'upore', 'niche',
    'ami', 'amar', 'amader', 'apni', 'apnar', 'tumi', 'tomar', 'se', 'tar', 'tader', 'amra',
    'ekta', 'ekti', 'kichu', 'kisu', 'sob', 'shob', 'onek', 'khub', 'beshi', 'kom', 'ektu',
    'valo', 'bhalo', 'kharap', 'uchit', 'dorkar', 'proyojon', 'niyom', 'bidhan', 'hukum', 'somporke', 'bishoye',
    'islam', 'islame', 'islamer', 'islamic', 'muslim', 'masala', 'fatwa', 'dalil', 'sahih',
    'please', 'plz', 'pls', 'tell', 'me', 'give', 'ruling', 'allowed', 'permissible', 'valid', 'break', 'breaks', 'broken', 'does', 'during', 'while',
  ]);

  // Exact surface framing words (NOT passed through stemBn so 'জানতে' never stems to 'জান' and 'দাঁড়িয়ে' never stems to 'দাড়ি'!)
  const EXACT_GENERIC_WORDS = new Set(
    [
      'কি', 'কী', 'কেন', 'কখন', 'কোথায়', 'কিভাবে', 'কীভাবে', 'কেমন', 'কোন', 'কোনো', 'কোনটি',
      'কত', 'কয়', 'কয়টি', 'কতক্ষণ', 'কতদিন', 'কার', 'কাকে', 'কে', 'কারা',
      'হয়', 'হবে', 'হলে', 'হলো', 'হল', 'হয়েছে', 'হচ্ছে', 'হতে', 'হওয়া',
      'যায়', 'যাবে', 'গেলে', 'যাওয়া', 'পারে', 'পারবে', 'পারা', 'পারি',
      'করা', 'করে', 'করলে', 'করব', 'করবো', 'করবে', 'করবেন', 'করতে', 'করার', 'করেন',
      'দেওয়া', 'দেয়া', 'দিলে', 'দিতে', 'দেওয়ার', 'দেয়ার', 'দিব', 'দিবো', 'দেবো', 'দেবে', 'দেবেন',
      'নেওয়া', 'নেয়া', 'নিলে', 'নিতে', 'নেওয়ার', 'নেয়ার', 'নিব', 'নিবো', 'নেবো', 'নেবে', 'নেবেন',
      'বলা', 'বলার', 'বলে', 'বললে', 'বলেন', 'বলব', 'বলবো', 'বলবে', 'বলবেন', 'বলতে',
      'আছে', 'নেই', 'নাই', 'থাকা', 'থাকে', 'থাকলে', 'থাকব', 'থাকবো', 'থাকবে',
      'গিয়ে', 'গিয়ে', 'এসে', 'আসা', 'বসে', 'পড়া', 'পড়ার', 'পড়লে', 'পড়ব', 'পড়বো', 'পড়বে', 'পড়বেন', 'পড়তে',
      'রাখা', 'রাখার', 'রাখলে', 'রাখব', 'রাখবো', 'রাখবে', 'রাখবেন', 'রাখতে',
      'দিয়ে', 'নিয়ে', 'হয়ে', 'করেই', 'ভাবে', 'পাওয়া', 'পাওয়ার',
      'জন্য', 'থেকে', 'সাথে', 'সঙ্গে', 'মধ্যে', 'ভেতরে', 'উপর', 'উপরে', 'ওপর',
      'এবং', 'ও', 'বা', 'অথবা', 'কিন্তু', 'তবে', 'যদি', 'তাহলে', 'নাকি', 'না', 'নয়',
      'এই', 'সেই', 'ওই', 'এটি', 'সেটি', 'এটা', 'সেটা', 'একটি', 'একটা', 'কিছু', 'সব', 'সকল',
      'আমার', 'আমাদের', 'আপনার', 'তাদের', 'তার', 'আমি', 'আমরা', 'তুমি', 'আপনি',
      'ইসলাম', 'ইসলামে', 'ইসলামের', 'ইসলামিক', 'ইসলামী', 'মুসলিম', 'মুসলমান', 'শারঈ', 'শরঈ', 'শরীয়ত', 'শরীআত',
      'প্রশ্ন', 'উত্তর', 'জবাব', 'জানতে', 'চাই', 'বলুন', 'বলো', 'জানান', 'দাও', 'দিন', 'বিষয়ে', 'সম্পর্কে', 'ব্যাপারে',
      'বিধান', 'হুকুম', 'নিয়ম', 'নিয়মাবলি', 'নিয়মাবলী', 'পদ্ধতি', 'তরীকা', 'তরিকা', 'বিবরণ',
      'মাসআলা', 'ফতোয়া', 'দলিল', 'দলিলসহ', 'আলোকে', 'অবস্থান', 'দৃষ্টিভঙ্গি',
      'আসসালামু', 'আলাইকুম', 'রাহমাতুল্লাহ', 'রাহমাতুল্লাহি', 'বারাকাতুহু', 'ওয়া',
      'হুজুর', 'শায়খ', 'শায়েখ', 'স্যার',
      'দয়া', 'অনুগ্রহ', 'প্লিজ', 'একটু', 'আচ্ছা', 'হ্যালো', 'হাই', 'আজকে', 'এখন', 'সঠিক', 'উচিত', 'করণীয়', 'ব্যবহার',
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'do', 'does', 'can',
      'in', 'on', 'of', 'to', 'for', 'with', 'about', 'the', 'and', 'or', 'islam', 'islamic', 'muslim',
      'assalamu', 'alaikum', 'hujur', 'sheikh', 'hello', 'hi', 'hey', 'please',
    ].map(foldBn)
  );

  const SAFE_STEMMED_GENERIC_WORDS = new Set(
    [
      'কিভাবে', 'কোথায়', 'হয়েছে', 'হচ্ছে', 'যাওয়া', 'করলে', 'করতে', 'করার',
      'দেওয়া', 'দেওয়ার', 'নেওয়া', 'নেওয়ার', 'পড়ার', 'রাখার', 'থাকলে', 'পাওয়ার',
      'সম্পর্কে', 'ব্যাপারে', 'ইসলামের', 'ইসলামিক', 'শরীয়ত', 'শরীআত',
      'নিয়মাবলি', 'পদ্ধতি', 'মাসআলা', 'ফতোয়া', 'দলিলসহ', 'দৃষ্টিভঙ্গি', 'অনুগ্রহ', 'করণীয়',
    ].map((w) => stemBn(foldBn(w)))
  );

  function stripLeadingGreeting(q) {
    return String(q || '').replace(
      /^\s*(?:আসসালামু\s*আলাইকুম|আস-সালামু\s*আলাইকুম|সালামু?\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam)(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?)?(?:\s*(?:ভাই|ভাইয়া|বোন|হুজুর|শায়খ))?[\s,।!?\-:]+/iu,
      ' '
    );
  }

  function isCoreToken(tok) {
    if (!tok || tok.length < 2 || /^\d+$/.test(tok)) return false;
    const folded = foldBn(tok);
    if (EXACT_GENERIC_WORDS.has(folded) || SAFE_STEMMED_GENERIC_WORDS.has(tok) || BANGLISH_STOP_WORDS.has(tok)) return false;
    return true;
  }

  // Replace known Banglish/English words (including inflected Banglish suffixes like -er, -r, -te, -ke, -der)
  // with Bengali equivalents while preserving unknown non-Banglish English words for strict OOD abstention!
  const BANGLISH_INFLECTION_SUFFIXES = ['gulo', 'gula', 'der', 'ter', 'tar', 'tir', 'er', 'te', 'ke', 'ta', 'ti', 'ra', 'e', 'y', 'r', 's', 'ing'];
  function resolveBanglishWord(rawW) {
    const candidates = [rawW, rawW.replace(/([aeiou])\1+/g, '$1')];
    for (const w of candidates) {
      if (BANGLISH_AND_EN_MAP[w]) return BANGLISH_AND_EN_MAP[w];
      for (const suf of BANGLISH_INFLECTION_SUFFIXES) {
        if (w.length - suf.length >= 3 && w.endsWith(suf)) {
          const stem = w.slice(0, -suf.length);
          if (BANGLISH_AND_EN_MAP[stem]) return BANGLISH_AND_EN_MAP[stem];
        }
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
      for (const suf of ['er', 'te', 'ke', 'ta', 'ti', 'ra', 'e', 'y', 'r']) {
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
    salam: /^\s*(?:আসসালামু\s*আলাইকুম|আস-সালামু\s*আলাইকুম|সালামু?\s*আলাইকুম|সালাম|assalamu\s*alaikum|as-salamu\s*alaikum|salam|slm)(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?|\s+wa\s*rahmatullah(?:i\s*wa\s*barakatuhu?)?)?(?:\s*[।,!?\-]*\s*(?:ভাই|ভাইয়া|বোন|বন্ধু|তুমি\s*কেমন\s*আছো?|কেমন\s*আছো?(?:\s*তুমি)?|কেমন\s*আছেন(?:\s*আপনি)?|kemon\s*ach(?:o|en)|kmn\s*ach(?:o|en)|kemon\s*as(?:o|en)))?[।!?.,\s]*$/i,
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
    { id: 'dhaka', bn: 'ঢাকা', lat: 23.7104, lon: 90.40744, aliases: ['ঢাকা', 'ঢাকায়', 'ঢাকার', 'dhaka'] },
    { id: 'chattogram', bn: 'চট্টগ্রাম', lat: 22.3569, lon: 91.7832, aliases: ['চট্টগ্রাম', 'চট্টগ্রামে', 'চিটাগং', 'chittagong', 'chattogram', 'ctg'] },
    { id: 'sylhet', bn: 'সিলেট', lat: 24.8949, lon: 91.8687, aliases: ['সিলেট', 'সিলেটে', 'sylhet'] },
    { id: 'rajshahi', bn: 'রাজশাহী', lat: 24.3745, lon: 88.6042, aliases: ['রাজশাহী', 'রাজশাহীতে', 'rajshahi'] },
    { id: 'khulna', bn: 'খুলনা', lat: 22.8456, lon: 89.5403, aliases: ['খুলনা', 'খুলনায়', 'khulna'] },
    { id: 'barishal', bn: 'বরিশাল', lat: 22.7010, lon: 90.3535, aliases: ['বরিশাল', 'বরিশালে', 'barishal', 'barisal'] },
    { id: 'rangpur', bn: 'রংপুর', lat: 25.7439, lon: 89.2752, aliases: ['রংপুর', 'রংপুরে', 'rangpur'] },
    { id: 'mymensingh', bn: 'ময়মনসিংহ', lat: 24.7471, lon: 90.4203, aliases: ['ময়মনসিংহ', 'ময়মনসিংহে', 'mymensingh'] },
    { id: 'cumilla', bn: 'কুমিল্লা', lat: 23.4607, lon: 91.1809, aliases: ['কুমিল্লা', 'কুমিল্লায়', 'comilla', 'cumilla'] },
    { id: 'gazipur', bn: 'গাজীপুর', lat: 23.9999, lon: 90.4203, aliases: ['গাজীপুর', 'গাজীপুরে', 'gazipur'] },
    { id: 'narayanganj', bn: 'নারায়ণগঞ্জ', lat: 23.6238, lon: 90.5000, aliases: ['নারায়ণগঞ্জ', 'নারায়ণগঞ্জে', 'narayanganj'] },
    { id: 'bogura', bn: 'বগুড়া', lat: 24.8465, lon: 89.3773, aliases: ['বগুড়া', 'বগুড়ায়', 'bogra', 'bogura'] },
    { id: 'coxsbazar', bn: 'কক্সবাজার', lat: 21.4272, lon: 92.0058, aliases: ['কক্সবাজার', 'কক্সবাজারে', 'coxsbazar', 'cox'] },
    { id: 'jashore', bn: 'যশোর', lat: 23.1664, lon: 89.2081, aliases: ['যশোর', 'যশোরে', 'jessore', 'jashore'] },
    { id: 'dinajpur', bn: 'দিনাজপুর', lat: 25.6217, lon: 88.6354, aliases: ['দিনাজপুর', 'দিনাজপুরে', 'dinajpur'] },
    { id: 'noakhali', bn: 'নোয়াখালী', lat: 22.8696, lon: 91.0995, aliases: ['নোয়াখালী', 'নোয়াখালীতে', 'মাইজদী', 'noakhali'] },
    { id: 'feni', bn: 'ফেনী', lat: 23.0159, lon: 91.3976, aliases: ['ফেনী', 'ফেনীতে', 'feni'] },
    { id: 'pabna', bn: 'পাবনা', lat: 24.0064, lon: 89.2372, aliases: ['পাবনা', 'পাবনায়', 'pabna'] },
    { id: 'tangail', bn: 'টাঙ্গাইল', lat: 24.2513, lon: 89.9167, aliases: ['টাঙ্গাইল', 'টাঙ্গাইলে', 'tangail'] },
    { id: 'kushtia', bn: 'কুষ্টিয়া', lat: 23.9013, lon: 89.1204, aliases: ['কুষ্টিয়া', 'কুষ্টিয়ায়', 'kushtia'] },
    { id: 'faridpur', bn: 'ফরিদপুর', lat: 23.6070, lon: 89.8429, aliases: ['ফরিদপুর', 'ফরিদপুরে', 'faridpur'] },
    { id: 'brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া', lat: 23.9571, lon: 91.1119, aliases: ['ব্রাহ্মণবাড়িয়া', 'বিবাড়িয়া', 'brahmanbaria'] },
    { id: 'moulvibazar', bn: 'মৌলভীবাজার', lat: 24.4829, lon: 91.7774, aliases: ['মৌলভীবাজার', 'শ্রীমঙ্গল', 'moulvibazar'] },
    { id: 'satkhira', bn: 'সাতক্ষীরা', lat: 22.7185, lon: 89.0705, aliases: ['সাতক্ষীরা', 'satkhira'] },
    { id: 'sirajganj', bn: 'সিরাজগঞ্জ', lat: 24.4534, lon: 89.7007, aliases: ['সিরাজগঞ্জ', 'sirajganj'] },
    { id: 'kishoreganj', bn: 'কিশোরগঞ্জ', lat: 24.4449, lon: 90.7766, aliases: ['কিশোরগঞ্জ', 'kishoreganj'] },
    { id: 'jamalpur', bn: 'জামালপুর', lat: 24.9375, lon: 89.9378, aliases: ['জামালপুর', 'jamalpur'] },
    { id: 'netrokona', bn: 'নেত্রকোনা', lat: 24.8710, lon: 90.7279, aliases: ['নেত্রকোনা', 'netrokona'] },
    { id: 'sherpur', bn: 'শেরপুর', lat: 25.0205, lon: 90.0153, aliases: ['শেরপুর', 'sherpur'] },
    { id: 'manikganj', bn: 'মানিকগঞ্জ', lat: 23.8644, lon: 90.0047, aliases: ['মানিকগঞ্জ', 'manikganj'] },
    { id: 'munshiganj', bn: 'মুন্সীগঞ্জ', lat: 23.5422, lon: 90.5305, aliases: ['মুন্সীগঞ্জ', 'munshiganj'] },
    { id: 'narsingdi', bn: 'নরসিংদী', lat: 23.9322, lon: 90.7151, aliases: ['নরসিংদী', 'narsingdi'] },
    { id: 'gopalganj', bn: 'গোপালগঞ্জ', lat: 23.0051, lon: 89.8266, aliases: ['গোপালগঞ্জ', 'gopalganj'] },
    { id: 'madaripur', bn: 'মাদারীপুর', lat: 23.1641, lon: 90.1897, aliases: ['মাদারীপুর', 'madaripur'] },
    { id: 'rajbari', bn: 'রাজবাড়ী', lat: 23.7574, lon: 89.6445, aliases: ['রাজবাড়ী', 'rajbari'] },
    { id: 'shariatpur', bn: 'শরীয়তপুর', lat: 23.2423, lon: 90.4348, aliases: ['শরীয়তপুর', 'shariatpur'] },
    { id: 'chandpur', bn: 'চাঁদপুর', lat: 23.2333, lon: 90.6713, aliases: ['চাঁদপুর', 'chandpur'] },
    { id: 'lakshmipur', bn: 'লক্ষ্মীপুর', lat: 22.9447, lon: 90.8282, aliases: ['লক্ষ্মীপুর', 'lakshmipur'] },
    { id: 'rangamati', bn: 'রাঙ্গামাটি', lat: 22.6533, lon: 92.1789, aliases: ['রাঙ্গামাটি', 'rangamati'] },
    { id: 'bandarban', bn: 'বান্দরবান', lat: 22.1953, lon: 92.2184, aliases: ['বান্দরবান', 'bandarban'] },
    { id: 'khagrachhari', bn: 'খাগড়াছড়ি', lat: 23.1193, lon: 91.9847, aliases: ['খাগড়াছড়ি', 'khagrachhari'] },
    { id: 'habiganj', bn: 'হবিগঞ্জ', lat: 24.3749, lon: 91.4155, aliases: ['হবিগঞ্জ', 'habiganj'] },
    { id: 'sunamganj', bn: 'সুনামগঞ্জ', lat: 25.0658, lon: 91.3950, aliases: ['সুনামগঞ্জ', 'sunamganj'] },
    { id: 'natore', bn: 'নাটোর', lat: 24.4206, lon: 89.0003, aliases: ['নাটোর', 'natore'] },
    { id: 'naogaon', bn: 'নওগাঁ', lat: 24.7936, lon: 88.9318, aliases: ['নওগাঁ', 'naogaon'] },
    { id: 'chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ', lat: 24.5965, lon: 88.2775, aliases: ['চাঁপাইনবাবগঞ্জ', 'নবাবগঞ্জ', 'chapainawabganj'] },
    { id: 'joypurhat', bn: 'জয়পুরহাট', lat: 25.0968, lon: 89.0227, aliases: ['জয়পুরহাট', 'joypurhat'] },
    { id: 'bagerhat', bn: 'বাগেরহাট', lat: 22.6516, lon: 89.7859, aliases: ['বাগেরহাট', 'bagerhat'] },
    { id: 'chuadanga', bn: 'চুয়াডাঙ্গা', lat: 23.6402, lon: 88.8418, aliases: ['চুয়াডাঙ্গা', 'chuadanga'] },
    { id: 'jhenaidah', bn: 'ঝিনাইদহ', lat: 23.5450, lon: 89.1726, aliases: ['ঝিনাইদহ', 'jhenaidah'] },
    { id: 'magura', bn: 'মাগুরা', lat: 23.4873, lon: 89.4199, aliases: ['মাগুরা', 'magura'] },
    { id: 'meherpur', bn: 'মেহেরপুর', lat: 23.7622, lon: 88.6318, aliases: ['মেহেরপুর', 'meherpur'] },
    { id: 'narail', bn: 'নড়াইল', lat: 23.1725, lon: 89.5127, aliases: ['নড়াইল', 'narail'] },
    { id: 'bhola', bn: 'ভোলা', lat: 22.6859, lon: 90.6482, aliases: ['ভোলা', 'bhola'] },
    { id: 'patuakhali', bn: 'পটুয়াখালী', lat: 22.3596, lon: 90.3299, aliases: ['পটুয়াখালী', 'patuakhali'] },
    { id: 'pirojpur', bn: 'পিরোজপুর', lat: 22.5791, lon: 89.9759, aliases: ['পিরোজপুর', 'pirojpur'] },
    { id: 'barguna', bn: 'বরগুনা', lat: 22.1592, lon: 90.1256, aliases: ['বরগুনা', 'barguna'] },
    { id: 'jhalokati', bn: 'ঝালকাঠি', lat: 22.6406, lon: 90.1987, aliases: ['ঝালকাঠি', 'jhalokati'] },
    { id: 'thakurgaon', bn: 'ঠাকুরগাঁও', lat: 26.0337, lon: 88.4617, aliases: ['ঠাকুরগাঁও', 'thakurgaon'] },
    { id: 'panchagarh', bn: 'পঞ্চগড়', lat: 26.3411, lon: 88.5542, aliases: ['পঞ্চগড়', 'তেঁতুলিয়া', 'panchagarh'] },
    { id: 'nilphamari', bn: 'নীলফামারী', lat: 25.9318, lon: 88.8560, aliases: ['নীলফামারী', 'সৈয়দপুর', 'nilphamari'] },
    { id: 'kurigram', bn: 'কুড়িগ্রাম', lat: 25.8054, lon: 89.6362, aliases: ['কুড়িগ্রাম', 'kurigram'] },
    { id: 'gaibandha', bn: 'গাইবান্ধা', lat: 25.3288, lon: 89.5281, aliases: ['গাইবান্ধা', 'gaibandha'] },
    { id: 'lalmonirhat', bn: 'লালমনিরহাট', lat: 25.9923, lon: 89.2847, aliases: ['লালমনিরহাট', 'lalmonirhat'] },
  ];

  function findNearestCityByCoords(lat, lon) {
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) return BD_CITIES[0];
    const rad = Math.PI / 180;
    let best = BD_CITIES[0];
    let bestDist = Infinity;
    for (const c of BD_CITIES) {
      const dLat = (c.lat - numLat) * rad;
      const dLon = (c.lon - numLon) * rad;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(numLat * rad) * Math.cos(c.lat * rad) * Math.sin(dLon / 2) ** 2;
      const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  function detectCityInText(text, fallbackCityId = 'dhaka') {
    const low = foldBn(String(text || ''));
    for (const c of BD_CITIES) {
      for (const al of c.aliases) {
        if (low.includes(foldBn(al))) return c;
      }
    }
    if (fallbackCityId === null) return null;
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

  // Karachi 18°/18° astronomical calculation with both Shafi'i/Ahle Hadith (1x) & Hanafi/IFB (2x) Asr support
  function computePrayerSchedule(cityInput = 'dhaka', dateObj = new Date(), asrMethod = null) {
    const city = typeof cityInput === 'string' ? detectCityInText(cityInput, cityInput) : cityInput;
    const chosenMethod =
      asrMethod ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('dawahx_asr_method')) ||
      'hanafi';
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
    const monthsBn = ['', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const dateLabelBn = `${toBnDigitsStr(D)} ${monthsBn[M] || ''} ${toBnDigitsStr(Y)}`;

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

    const sunriseDec = dhuhr - ha(-0.8333);
    const sunsetDec = dhuhr + ha(-0.8333);
    const fajrDec = dhuhr - ha(-18);
    const nightDuration = ((fajrDec + 24) - sunsetDec) % 24;
    const lastThirdStartDec = sunsetDec + (nightDuration * 2) / 3;

    const raw = {
      sehriEnd: formatHourBn(fajrDec - 3 / 60),
      fajr: formatHourBn(fajrDec),
      sunrise: formatHourBn(sunriseDec),
      ishraq: formatHourBn(sunriseDec + 15 / 60),
      dhuhr: formatHourBn(dhuhr + 3 / 60),
      asr: formatHourBn(dhuhr + asrHa(1)),
      asrHanafi: formatHourBn(dhuhr + asrHa(2)),
      maghrib: formatHourBn(sunsetDec),
      iftarIfb: formatHourBn(sunsetDec + 3 / 60),
      isha: formatHourBn(dhuhr + ha(-18)),
      tahajjud: formatHourBn(lastThirdStartDec),
    };

    const prohibited = [
      { label: 'সূর্যোদয়ের সময়', range: `${raw.sunrise.short} – ${raw.ishraq.short}` },
      { label: 'ঠিক দ্বিপ্রহর (জাওয়াল)', range: `${formatHourBn(dhuhr - 3 / 60).short} – ${raw.dhuhr.short}` },
      { label: 'সূর্যাস্তের পূর্বমুহূর্ত', range: `${formatHourBn(sunsetDec - 15 / 60).short} – ${raw.maghrib.short}` },
    ];

    const activeAsr = chosenMethod === 'shafi' ? raw.asr : raw.asrHanafi;
    const order = [
      { key: 'fajr', name: 'ফজর', t: raw.fajr },
      { key: 'sunrise', name: 'সূর্যোদয়', t: raw.sunrise },
      { key: 'dhuhr', name: 'যোহর', t: raw.dhuhr },
      { key: 'asr', name: 'আসর', t: activeAsr },
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
      date_label_bn: dateLabelBn,
      asr_method: chosenMethod,
      times: raw,
      prohibited,
      current_waqt: currentWaqt,
      next_waqt_name: nextWaqt.name,
      next_waqt_time: nextWaqt.t.label,
      countdown_bn: countdown,
    };
  }

  // Precision Prayer / Sehri / Iftar Timetable Detector
  // Distinguishes genuine schedule requests ("আজকের নামাজের সময়সূচি", "চুয়াডাঙ্গায় ইফতার কয়টায়")
  // from fiqh questions containing "নামাজের সময় ..." ("during prayer", e.g., "নামাজের সময় হাত বুকের উপর বাঁধবে নাকি নাভির নিচে")!
  const FIQH_RULING_MARKER_RE =
    /(?:কাযা|ক্বাযা|কাজা|ছুটে\s*গেলে|ভুলে|রাকআত|রাকাত|ফরয|ফরজ|ওয়াজিব|সুন্নাত|সুন্নাহ|নফল|মাকরূহ|সিজদা|সেজদা|রুকু|ওযু|ওযূ|অজু|গোসল|ভঙ্গ|ভাঙ|ভাঙ্গ|নষ্ট|জায়েয|জায়েজ|হারাম|হালাল|গুনাহ|পাপ|সওয়াব|ছওয়াব|ফযীলত|ফজিলত|বিধান|হুকুম|মাসআলা|ফতোয়া|নিয়ম|পদ্ধতি|হাদীস|হাদিস|দলিল|দলীল|কুরআন|আয়াত|হাত|বুক|নাভি|নাভী|বাঁধ|বাধ|রাফউল|ইয়াদাইন|আমীন|আমিন|সানা|ছানা|তাশাহহুদ|আত্তাহিয়্যাতু|দরূদ|দাঁড়া|বসা|দৃষ্টি|চোখ|তাকানো|মোবাইল|কাপড়|পোশাক|টুপি|হাই|হাঁচি|কান্না|হাসি|সন্দেহ|ইমাম|মুক্তাদী|মাসবুক|জামাত|জামাআত|কাতার|দোয়া|দুআ|যিকির|তাসবীহ|কিরাত|সূরা|ফাতিহা|নাকি|কোথায়|কীভাবে|কিভাবে|কেন|করণীয়|পড়তে|বলতে|রাখতে|খাওয়া|পান\s*কর|ঘুম|স্ত্রী|স্বামী|নারী|মহিলা)/iu;

  const EXPLICIT_SCHEDULE_CLOCK_RE =
    /(?:(?:নামাজ|নামায|সালাত|ছালাত|ইফতার|সেহরি|সাহরী|রমযান|রমজান)(?:ের|র)?\s*(?:সময়সূচ[িী]|টাইমটেবিল|ক্যালেন্ডার)|(?:ফজর|ফজরের|যোহর|যোহরের|আসর|আসরের|মাগরিব|মাগরিবের|এশা|এশার|ইফতার|ইফতারের|সেহরি|সেহরির|সাহরী|সাহরীর)\s*(?:(?:নামাজ|নামায|সালাত|ছালাত)(?:ের)?\s*)?(?:কয়টায়|কখন|টাইম|আযান|আজান)|(?:কয়টায়|কখন)\s*(?:ইফতার|সেহরি|সাহরী|আযান|আজান|ফজর|যোহর|আসর|মাগরিব|এশা)|(?:ওয়াক্ত|আযান|আজান)\s*(?:কখন|কয়টায়|টাইম)|এখন\s*কোন\s*ওয়াক্ত|আজকের?\s*(?:নামাজের|সালাতের)\s*(?:সময়|টাইম|ওয়াক্ত)|prayer\s*(?:times?|schedule)|namaz\s*(?:times?|schedule)|namajer\s*(?:somoy\s*suchi|time)|salat\s*(?:times?|schedule)|iftar\s*times?|iftarer\s*time|sehri\s*times?|sehrir\s*time|fajr\s*time|maghrib\s*time)/iu;

  const ANCHORED_SHORT_SCHEDULE_RE =
    /^\s*(?:আজ(?:কে|কের)?\s*)?(?:[\p{L}\p{M}\s]{1,24}?\s+)?(?:নামাজ|নামায|সালাত|ছালাত|ইফতার|সেহরি|সাহর[ীি]|ফজর|যোহর|আসর|মাগরিব|এশা)(?:ের|র)?\s*(?:শেষ\s*)?(?:সময়|টাইম|ওয়াক্ত)(?:\s*(?:কত|কখন|কয়টায়|দাও|দিন|বলো|বলুন|দেখাও|জানাও|তালিকা))?[।!?.,\s]*$/iu;

  function isPrayerScheduleRequest(q) {
    if (!q || FIQH_RULING_MARKER_RE.test(q)) return false;
    return EXPLICIT_SCHEDULE_CLOCK_RE.test(q) || ANCHORED_SHORT_SCHEDULE_RE.test(q);
  }

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
  const RECENT_CONTENT_QUERY_RE = /(?:নতুন\s*ক[িী].*(?:লেখা|প্রবন্ধ|ফতোয়া|ভিডিও).*(?:এসেছে|প্রকাশিত|আছে)?|সাম্প্রতিক\s*(?:প্রকাশিত\s*)?(?:নতুন\s*)?(?:লেখা|ফতোয়া|ভিডিও|প্রকাশনা)|latest\s*(?:articles?|fatwas?|videos?))/i;
  const QUIZ_REQ_RE = /^\s*(?:আমাকে\s*)?(?:একটা\s*|আরেকটা\s*|নতুন\s*)?(?:ইসলামিক\s*)?(?:কুইজ\s*(?:ধরো|দাও|খেলব|প্রশ্ন\s*করো)|ধাঁধা\s*ধরো|প্রশ্ন\s*ধরো|quiz\s*me|islamic\s*quiz|another\s*quiz)[।!?.,\s]*$/i;

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

  // Flagship curated keys from DAWAH X's 8 topic-*.html hubs & cross-links.json
  const CURATED_TOPIC_KEYS = new Set([
    // cross-links.json (Noor vs Clay scholarly fatwas)
    '1d3f754a8a7002', '13333d8071f2a6', '0c335270d00954', '0b0471e1b009b8',
    // topic-existence.html
    '0493529ba58065', '0587a3f7457233', '1a91ca7d0712eb', '08fac1dee60093', '1202661b9fe54c', '0cdf73f12e8f68', '004359d299e433',
    // topic-evil.html (suffering & taqdeer)
    '1cb99d54e3dbb9', '0525150927894e', '01c79806c92bd0', '1094033cefd646', '0e9854a4208729', '11f0973784b55f', '13836e0d4bc6c5', '029a8512383018',
    // topic-quran.html
    '1c4dbe79ac96f1', '1a57bc546e833c', '1f57351228a3ee', '000159d3bc295d', '1a2dbb305dfc1d',
    // topic-hadith.html
    '11e2ebbfbbbb39', '04ac99c2084199', '13ef5c4dad0881', '0e148f5065c25b', '0c32c776937230',
    // topic-prophet.html
    '0af186aaea58f3', '1075d7cb7d16c9', '1ecf0c2e01d4e7', '0ccd83cbdaa711', '0ca3677a040774', '1392896e8d732c', '0a9b81336bacc6',
    // topic-women.html
    '1c6689e5f0e8e6', '0f69028005a2e5', '15b955e9a26004', '0d79bb28d3799a', '1c0f857f4d44b4', '1365d1764436fb',
    // topic-science.html
    '18f80876ace1e6', '1e26e3ae023362', '009bf4d4e5b0a7', '0b06567908d8fb', '0aee80e7a8cec8',
    // topic-sharia.html & core fiqh
    '0b08e5a2277cb1', '1228244de43364', '0b3c382d6936b5', '0c7724ccd2a0c5', '18d4eac2a82a69',
    '144f5241a6ecf5', '09e6a7e4dc9812', '0311fba512ab9a', '1b4b346ecdd0a1', '03f651a988c811',
    '0a4fb41f3833e7', '018deac31f383b', '1f249e55d5920f', '00043ee03b3362', '0dc4300795ece7',
    '0133402f0bd2c1', '06b5b887ffa687', '09054d597f4c20', '1eb47196942947', '1cefdabaa45c19',
  ]);
  const OTHER_RELIGION_RE = /(?:হিন্দু|হিন্দুধর্ম|বেদ|গীতা|মনুস্মৃতি|খ্রিস্টান|খ্রিষ্টান|বাইবেল|বৌদ্ধ|ইহুদি)/u;
  const POEM_OR_NEWS_RE = /(?:পঞ্চম\s*শ্রেণী|ষষ্ঠ\s*শ্রেণী|সপ্তম\s*শ্রেণী|অষ্টম\s*শ্রেণী|দুর্ঘটনায়\s*মৃত্যু|শ্রমিকের\s*মৃত্যু|প্রাকৃতিক\s*গ্যাস|মুদ্রার\s*মওজুদ|স্বর্ণ\s*মওজুদে)/u;
  // Canonical master DAWAH X document routes: ensures fundamental general questions always include
  // the definitive comprehensive treatise/fatwa in Stage-2 candidate evaluation!
  const CANONICAL_DOCTRINE_ROUTES = [
    { re: /(?:ওযু|ওযূ|অজু|ওজু).*(?:ভঙ্গ|ভাঙ্গ|ভাঙ|নষ্ট)/u, guardNo: /(?:উট|গোশত|দুধ|স্রাব|রক্ত|কৃমি|ধূমপান|ব্যান্ডেজ|স্পর্শ|হাঁটু|হাসি|ঘুম)/u, keys: ['0a4fb41f3833e7'] },
    { re: /(?:ওযু|ওযূ|অজু|ওজু).*(?:নিয়ম|পদ্ধতি|সুন্নাত|কীভাবে|কিভাবে)/u, guardNo: /(?:ভঙ্গ|ভাঙ|নষ্ট|মুখ|নাক|দাঁত|ব্যান্ডেজ|মোজার)/u, keys: ['06d0e4f730b63a', '10b73389aa32f2'] },
    { re: /(?:ফর[যজ]\s*গোসল|গোসল.*ফর[যজ]|জানাবাতের?\s*গোসল).*(?:নি(?:য়|য়)ম|পদ্ধতি|কীভাবে|কিভাবে|সুন্নাত)/u, guardNo: /(?:পুকুর|আবদ্ধ|জুমআ|না\s*মেনে|হাত-পা|দো‘আ|দরূদ)/u, keys: ['1cefdabaa45c19'] },
    { re: /(?:বিতর).*(?:নিয়ম|পদ্ধতি|রাকাত|রাকআত|কীভাবে|কিভাবে)/u, guardNo: /(?:দুআ|দোয়া|কুনূত|সূরা\s*ইখলাস|রাফউল)/u, keys: ['063dbfc2ec3aa6', '11338c71b78221'] },
    { re: /(?:জানাযা|জানাজা).*(?:নিয়ম|পদ্ধতি|দোয়া|দুআ|কীভাবে|কিভাবে|তাকবীর|পড়ার|পড়ার)/u, guardNo: /(?:হিজড়া|গায়েবানা|মাসবূক|জুতা|কবর\s*উপর|মহিলা|দলবদ্ধ|হাত\s*তুলে)/u, keys: ['0dc4300795ece7', '1c9ba0b3dd232a'] },
    { re: /(?:দাড়ি|শ্মশ্রু).*(?:ফরয|ফরজ|ওয়াজিব|বিধান|হুকুম|রাখা)/u, guardNo: /(?:সামরিক|পুলিশ|চাকরি|ভ্রু|গোঁফ|সাদা|কলপ|মেহেদী)/u, keys: ['09e6a7e4dc9812'] },
    { re: /(?:সাহু\s*সিজদা|সিজদায়ে?\s*সাহু)/u, guardNo: /(?:প্রথম\s*বৈঠকে)/u, keys: ['1eb47196942947', '097ab112ef1b07', '14f79b9b797217'] },
    { re: /(?:তালাক|ত্বালাক্ব).*(?:নিয়ম|পদ্ধতি|দেওয়া|দেয়া|প্রদান)/u, guardNo: /(?:রাগের|তিন\s*তালাক|হায়েয|গর্ভাবস্থায়|মোবাইলে|লিখিত)/u, keys: ['077aa37af30782', '1595337e9bc747', '0c33c448c05377'] },
    { re: /(?:ধূমপান|সিগারেট|বিড়ি|বিড়ি).*(?:হুকুম|বিধান|হারাম|জায়েয|গুনাহ)/u, guardNo: /(?:ওযু|ওযূ|অজু|দোকান|কারখানা)/u, keys: ['0c593787686e5d', '0d70227dacf7a0', '06db82bfef2787'] },
    { re: /(?:ছবি\s*(?:তোলা|উঠানো)|ভিডিও\s*করা|ফটোগ্রাফি)/u, guardNo: /(?:অনুষ্ঠান|গাছপালা|বিক্রি|কা‘বা|ত্বাওয়াফ)/u, keys: ['1a64a71c6ec653', '02e323b822cf30', '1113220c2f917c'] },
    { re: /(?:ব্যাংক|সূদ|সুদ|ইন্টারেস্ট).*(?:গরিব|গরীব|দান|মসজিদ|মাদরাসা|ক[িী]\s*(?:কর|করা)|কোথায়\s*দিব)/u, guardNo: /(?:চাকরি|বাসা\s*ভাড়া)/u, keys: ['191f87ff9805bd', '19d543182ffc2b', '16274e697fc7f8', '12eb142d80c616'] },
    { re: /(?:কবর|মাযার|মাজার).*(?:চাওয়া|প্রার্থনা|সাহায্য|মানত|শিরক)/u, guardNo: /(?:যিয়ারতের?\s*দোয়া|মৃত্যু\s*সংবাদ)/u, keys: ['1007cf96e6357c', '01f63481c6af41'] },
    { re: /(?:মিলাদ|মীলাদ).*(?:কিয়াম|ক্বিয়াম|বিধান|হুকুম|জায়েয|উদযাপন)/u, guardNo: /(?:ইমামের\s*পিছনে)/u, keys: ['0a429a9ee3184a', '1f9a8ef24b6091', '161516b47bb93a'] },
    { re: /(?:টাখনু).*(?:নিচে|নীচে)/u, guardNo: /(?:দর্জি|টেইলর|অসাবধানতাবশত)/u, keys: ['18fa9ebd8389d2', '1f56306135de47'] },
    { re: /(?:ক্যাশ\s*ব্যাক|ক্যাশব্যাক|cashback)/iu, guardNo: /(?:জুতা)/u, keys: ['018cb83c1d3f8a', '03134bd505f073', '0ef41b48e61261', '0d37fb25015b32'] },
    { re: /(?:বিকাশ|নগদ|রকেট|মোবাইল\s*ব্যাংকিং)/u, guardNo: /(?:ইয়ামেন|ক্যাশব্যাক|ক্যাশ\s*ব্যাক)/u, keys: ['10470efea39247', '0f132e9c3686a7', '1a438038c344df'] },
    { re: /(?:নারী|মহিলা).*(?:মসজিদ).*(?:সালাত|নামাজ|ছালাত|জায়েয)/u, guardNo: /(?:ইতিকাফ|মাসিক|হায়েয)/u, keys: ['144f5241a6ecf5', '16f9899beff63d'] },
    { re: /(?:জুমা|জুমআ).*(?:দিন|আমল|আদব|সুন্নাত)/u, guardNo: /(?:খুতবা|দুইবার|মাদরাসা|রাস্তা)/u, keys: ['018deac31f383b'] },
    { re: /(?:বিষন্নতা|হতাশা|মানসিক\s*অশান্তি)/u, guardNo: /(?:আত্মহত্যা)/u, keys: ['00043ee03b3362'] },
    { re: /(?:আয়েশা|আয়িশা).*(?:বিবাহ|বিয়ে|বয়স)/u, guardNo: /(?:যুদ্ধ|উষ্ট্র)/u, keys: ['0311fba512ab9a', '1b4b346ecdd0a1'] },
    { re: /(?:শাওয়াল).*(?:ছয়|রোজা|রোযা|সিয়াম|ছিয়াম)/u, guardNo: /(?:বৃহস্পতি)/u, keys: ['0dcde15325d912', '175b7d38ada65a'] },
    { re: /(?:কুরবানী|কুরবানি).*(?:আকীকা|আকিকা)/u, guardNo: /(?:চাঁদ)/u, keys: ['061d832ac14fb7', '00003931c1c4b9'] },
    { re: /(?:অমুসলিম|বিধর্মী).*(?:সালাম)/u, guardNo: /(?:পাগল)/u, keys: ['1f12aab5786d15', '14ecc78b923b2e'] },
    { re: /(?:গর্ভপাত|ভ্রূণ)/u, guardNo: /(?:তালাক|মিলনে|জানাযা)/u, keys: ['0669b41ed22903', '1e0fe979c1b273'] },
    { re: /(?:বদনযর|নযর\s*লাগা)/u, guardNo: /(?:আয়না)/u, keys: ['1dd580caf81a57', '1426b07ae81b0d'] },
    { re: /(?:ছালাত|সালাত|নামাজ|নামায).*(?:ভুল|ভুলে)/u, guardNo: /(?:প্রথম\s*বৈঠকে|সাহু)/u, keys: ['1dcc814041d3e6', '0bf792ab36211a'] },
    { re: /(?:রক্ত).*(?:দান|রোগী)/u, guardNo: /(?:ছিয়াম|রোজা|রোযা)/u, keys: ['0e5162eafdf4e6', '06621a0ab484b2'] },
    { re: /(?:আকীকা|আক্বীক্বা|আকিকা)/u, guardNo: /(?:কুরবানী|কুরবানি|রাতে|সাত\s*দিনের\s*পূর্বে)/u, keys: ['1b4f8e35097062', '0c51dd5f69b089'] },
    { re: /(?:মোহরানা|মহরানা|দেনমোহর)/u, guardNo: /(?:কুষ্ঠ|গালিগালাজ)/u, keys: ['19c1c06e395602', '17b38a949efb19'] },
    { re: /(?:বিদআত|বিদ‘আত).*(?:চেনার|উপায়|সংজ্ঞা|পরিচিতি)/u, guardNo: /(?:জানাযা)/u, keys: ['10ca47a619503b', '005d9613455021'] },
    { re: /(?:কসম|শপথ).*(?:ভাঙ|ভঙ্গ|কাফফারা)/u, guardNo: /(?:ছিয়াম|রোজা|রোযা|চুরি)/u, keys: ['0b99f332ace1f3', '00b9ccb9b5a2e1'] },
    { re: /(?:হাত).*(?:বুক|নাভি|নাভী|বাঁধ|বাধ|কোথায়)/u, guardNo: /(?:রুকুর?\s*পরে|জানাযা|মুনাজাত|মোনাজাত|তাকবীর)/u, keys: ['1cdcea4ead1cbb', '08e73ee2850642', '071c26f2fdf107', '1baadfbb8e91fa'] },
    { re: /(?:রাফউল|রাফঊল|রফউল)\s*(?:ইয়াদাইন|ইয়াদাইন)/u, guardNo: /(?:জানাযা|ঈদ)/u, keys: ['110b4ed099f3a5', '074e73d49c2328'] },
    { re: /(?:ইমাম).*(?:পিছনে|পেছনে).*(?:ফাতিহা|সূরা)/u, guardNo: /(?:জানাযা)/u, keys: ['1bd46f250c8b35', '18bb3603d2e5da'] },
    { re: /(?:শবে\s*বরাত|শবেবরাত|(?:১৫|15)\s*(?:ই\s*)?শা.?বান|নিছফে?\s*শা.?বান)/u, guardNo: /(?:মিরাজ)/u, keys: ['06b5b887ffa687', '09054d597f4c20', '1b65b342f52af7', '15f24620ba4128'] },
    { re: /(?:সালাত|ছালাত|নামাজ|নামায).*(?:মনোযোগ|একাগ্রতা|খুশ[ুূ])/u, guardNo: /(?:জানাযা)/u, keys: ['0133402f0bd2c1'] },
    { re: /(?:দুঃখ|কষ্ট|বিপদ|বিপর্যয়|মন্দ|প্রবলেম\s*অব\s*ইভল).*(?:কেন|পরীক্ষা|সমাধান|আল্লাহ|স্রষ্টা)|(?:আল্লাহ|স্রষ্টা).*(?:কষ্ট|বিপদ|দুঃখ|মন্দ)/u, guardNo: /(?:জানাযা|হায়েয)/u, keys: ['0525150927894e', '1cb99d54e3dbb9', '01c79806c92bd0', '1094033cefd646'] },
    { re: /(?:ঘুমা|শোয়া|শোয়ার|ঘুমের).*(?:দোয়া|দুআ|দু‘আ|যিকির|সুন্নাত)/u, guardNo: /(?:স্বপ্নদোষ|ওযু\s*ভঙ্গ)/u, keys: ['046ea7d62ef6e7', '0f0950b315ca96', '17bbe4c530babe', '1bc95f7738266b'] },
    { re: /(?:সকাল).*(?:সন্ধ্যা).*(?:যিকির|দোয়া|দুআ|দু‘আ|আমল)/u, guardNo: /(?:ইতিকাফ)/u, keys: ['0fa2a586f4f7bc', '1289482b1f7f8c', '1c86373a290d28', '00b565fb5c8db2'] },
    { re: /(?:নূর|নুর).*(?:মাটি|তৈরি|সৃষ্টি)|(?:মাটি).*(?:নূর|নুর)/u, guardNo: /(?:ফেরেশতা\s*কী\s*দিয়ে)/u, keys: ['1d3f754a8a7002', '13333d8071f2a6', '0c335270d00954', '0b0471e1b009b8'] },
    { re: /(?:হাদ[ীি][সছ]\s*ছা(?:ড়া|ড়া)|শুধু\s*কুরআন|আহলে\s*কুরআন|হাদ[ীি][সছ]\s*অস্বীকার)/u, guardNo: /(?:জানাযা)/u, keys: ['0e5c573e0b262e', '0caa6b962f402e', '0b2d558a3c90ab', '019684ea6a4b61'] },
    { re: /(?:হাদ[ীি][সছ]).*(?:কেন\s*মান|সংরক্ষ|প্রামাণ্য)/u, guardNo: /(?:জানাযা)/u, keys: ['106b9d4f372291', '0174fed07979e9', '0e5c573e0b262e'] },
    { re: /(?:আল্লাহর?\s*অস্তিত্ব|স্রষ্টার?\s*অস্তিত্ব)/u, guardNo: /(?:দুঃখ|কষ্ট|বিপদ|মন্দ)/u, keys: ['1a91ca7d0712eb', '1ec44457ca08ae', '0a27a4ca3a799c', '193ab1f14e5d38'] },
    { re: /(?:মো[যজ]া).*(?:মাস[াে]হ)/u, guardNo: /(?:জুতা)/u, keys: ['118c8069abbd56', '1f3be7051654a7', '0445613c35d72a', '1dd649fd4fefc0', '0bde1b22294b5d'] },
    { re: /(?:খা(?:ও|ওয়া|ওয়া)র?|খাবার|ভোজন).*(?:দো(?:য়|য়)া|দু(?:য়|য়)া|দো.?আ|দু.?আ)/u, guardNo: /(?:মসজিদ|অসুস্থ)/u, keys: ['0b11417433e3f6', '0062d8b45d375f'] },
  ];

  // =========================================================================
  // Smart Typeahead Suggestions
  // =========================================================================
  const SUGGESTION_BANK = [
    'ওযু ভাঙ্গার কারণ কয়টি ও কি কি?',
    'ফরজ গোসলের সঠিক নিয়ম কী?',
    'তায়াম্মুম করার সঠিক নিয়ম কী?',
    'মোযার উপর মাসাহ করার নিয়ম ও সময়সীমা কতক্ষণ?',
    'সিজদায়ে সাহু দেওয়ার সঠিক নিয়ম কী?',
    'নামাজে মনোযোগ বা খুশু বাড়ানোর উপায় কী?',
    'ফজরের নামাজ কাযা হলে কখন ও কীভাবে পড়তে হবে?',
    'মাসবুক ব্যক্তি কীভাবে সালাত পূর্ণ করবে?',
    'সফরে কসর নামাজ কত দিন পড়া যায়?',
    'বিতরের নামাজ পড়ার সঠিক নিয়ম কী?',
    'তাহাজ্জুদ নামাজ কত রাকাত এবং কখন পড়তে হয়?',
    'তারাবীহর সালাত কত রাকআত?',
    'ইস্তেখারার নামাজ ও দোয়া পড়ার নিয়ম কী?',
    'জানাযার নামাজের দোয়া ও সঠিক নিয়ম কী?',
    'জুমআর দিনে করণীয় সুন্নাত আমল কী কী?',
    'নারীদের মসজিদে গিয়ে সালাত আদায় করা কি জায়েয?',
    'ফরয সালাতের পর সম্মিলিত মোনাজাত করা যাবে কি?',
    'রোজা অবস্থায় ইনজেকশন বা স্যালাইন নিলে কি রোজা ভাঙে?',
    'রোজা রেখে টুথপেস্ট বা মিসওয়াক ব্যবহার করা যাবে কি?',
    'শাওয়ালের ৬ রোজার ফযীলত ও নিয়ম কী?',
    'আরাফার রোজা কবে রাখতে হবে?',
    'স্বর্ণ ও রৌপ্যের নিসাব ও যাকাত আদায়ের নিয়ম কী?',
    'ফিতরা কত টাকা ও কখন আদায় করতে হয়?',
    'একই পশুতে কুরবানী ও আকীকা দেওয়া যাবে কি?',
    'রাগের মাথায় তিন তালাক দিলে কি তালাক হয়ে যাবে?',
    'খুলা তালাকের শারঈ নিয়ম কী?',
    'পিতার সম্পত্তিতে মেয়েরা কতটুকু অংশ পাবে?',
    'পিতা-মাতার মৃত্যুর পর সন্তানের করণীয় কী?',
    'ইসলামে একাধিক বিবাহ বা বহুবিবাহের বিধান কী?',
    'বিকাশ বা নগদ ক্যাশব্যাক নেওয়া কি জায়েয?',
    'বিটকয়েন বা ক্রিপ্টোকারেন্সি ট্রেডিং কি হালাল?',
    'শেয়ার ব্যবসা কি হালাল নাকি হারাম?',
    'সুদের টাকা দিয়ে কী করা উচিত?',
    'গান-বাজনা ও মিউজিক শোনা কি হারাম?',
    'দাড়ি রাখা কি ফরয? দাড়ি কাটার বিধান কী?',
    'ছবি তোলা বা ভিডিও করা কি জায়েয?',
    'তাবীয ঝুলানো কি শিরক?',
    'বদনজর ও যাদুটোনা থেকে বাঁচার রুকইয়াহ কী?',
    'মাজারে মানত বা সিজদা করা কি শিরক?',
    'শবে বরাতের রোজা ও আমলের বিধান কী?',
    'মীলাদ মাহফিল ও কিয়াম করা কি জায়েয?',
    'আল্লাহর অস্তিত্বের যৌক্তিক ও বৈজ্ঞানিক প্রমাণ কী?',
    'একজন স্রষ্টা থাকলে পৃথিবীতে দুঃখ-কষ্ট কেন আছে?',
    'কুরআন কীভাবে অবিকৃতভাবে সংরক্ষিত হয়েছে?',
    'নবীজি ﷺ কি নূরের তৈরি নাকি মাটির তৈরি?',
    'আয়েশা (রাঃ)-এর বিবাহের বয়স নিয়ে অভিযোগের জবাব কী?',
    'ডারউইনের বিবর্তনবাদ সম্পর্কে ইসলামের অবস্থান কী?',
    'ইসলামে বিষন্নতা, হতাশা ও মানসিক অশান্তি থেকে মুক্তির উপায় কী?',
    'অমুসলিমকে সালাম দেওয়া যাবে কি?',
    'আয়াতুল কুরসী অর্থসহ বলো',
    'সাইয়্যিদুল ইস্তিগফার অর্থসহ বলো',
    'ঘুমানোর আগের দোয়া কী?',
    'খাওয়ার শুরু ও শেষের দোয়া বলো',
    'আজকের নামাজের সময়সূচি দাও',
    'আজকে নতুন কি কি লেখা বা ভিডিও এসেছে?',
  ];

  const MANDATORY_ANCHOR_STEMS = new Set(
    [
      'জানাযা', 'তাহাজ্জুদ', 'তারাবীহ', 'বিতর', 'আকীকা', 'ফিতরা', 'কুরবানী',
      'তাবিজ', 'দাড়ি', 'হস্তমৈথুন', 'আত্মহত্যা', 'বিটকয়েন', 'ক্রিপ্টোকারেন্সি',
      'শেয়ার', 'বীমা', 'ইনস্যুরেন্স', 'পরকীয়া', 'খুলা', 'মোহর', 'আয়েশা',
      'ওযু', 'গোসল', 'তায়াম্মুম', 'হায়েয', 'ইতিকাফ', 'সুদ', 'বিকাশ', 'ক্যাশব্যাক',
      'সাহু', 'তালাক', 'ত্বালাক্ব', 'ধূমপান', 'মিলাদ', 'মীলাদ', 'টাখনু', 'কসর', 'ক্বছর',
    ].map((w) => stemBn(foldBn(w)))
  );

  function handleDialogueTurn(question, totalDocs, totalVids, history, t0) {
    const q = String(question || '').trim();
    if (!q) return null;

    let lastCtx = null;
    let activeQuizId = null;
    let userName = '';
    let userCity = 'dhaka';
    let userAsrMethod = 'hanafi';
    try {
      const store = root.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (store) {
        const savedCity = store.getItem('dawahx_user_city_v4');
        if (savedCity && BD_CITIES.some((d) => d.id === savedCity)) userCity = savedCity;
        const savedAsr = store.getItem('dawahx_asr_method');
        if (savedAsr === 'shafi' || savedAsr === 'hanafi') userAsrMethod = savedAsr;
      }
    } catch (_) {}

    const MY_CITY_STATEMENT_RE = /^\s*(?:আমি\s+|আমার\s*(?:বাসা|বাড়ি|শহর|জেলা)\s+)([\p{L}\p{M}\s'-]{2,30}?)(?:\s+(?:জেলায়\s*)?(?:থাকি|আছি|বসবাস\s*করি|থেকে\s*বলছি))?[।!?.,\s]*$/iu;
    const matchSavedDistrictOnly = (txt) => {
      const m = String(txt || '').match(MY_CITY_STATEMENT_RE);
      if (!m) return null;
      return detectCityInText(m[1], null);
    };

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
          const foundCity = matchSavedDistrictOnly(txt);
          if (foundCity) userCity = foundCity.id;
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
      is_deterministic_tool: extras.deterministic !== false,
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

    // 0c. Live Prayer, Sehri & Iftar Schedule across all 64 districts of Bangladesh
    if (isPrayerScheduleRequest(q)) {
      const cityObj = detectCityInText(q, userCity);
      const sched = computePrayerSchedule(cityObj, new Date(), userAsrMethod);
      const tm = sched.times;
      const hj = getHijriDateBn(new Date());
      return makeChat(
        `**${sched.city}** জেলার আজকের নামাজ, সেহরি ও ইফতারের সময়সূচি — **${sched.date_label_bn}** *(আনুমানিক ${hj.label})*:`,
        [
          `• **সেহরির শেষ সময়:** ${tm.sehriEnd.label} *(সতর্কতামূলক; ফজর শুরু: ${tm.fajr.label})*\n• **ফজর শুরু:** ${tm.fajr.label} · **সূর্যোদয়:** ${tm.sunrise.label}\n• **ইশরাক (নফল):** ${tm.ishraq.label}\n• **যোহর:** ${tm.dhuhr.label}\n• **আসর (আহলে হাদীস / শাফেঈ — ১ ছায়া):** ${tm.asr.label}\n• **আসর (হানাফী / ই.ফা. — ২ ছায়া):** ${tm.asrHanafi.label}\n• **মাগরিব / ইফতার (সূর্যাস্ত):** ${tm.maghrib.label} *(ই.ফা. সতর্কতামূলক +৩ মি.: ${tm.iftarIfb.label})*\n• **এশা:** ${tm.isha.label} · **তাহাজ্জুদ (শেষ তৃতীয়াংশ):** ${tm.tahajjud.label}`,
          `🕌 **বর্তমান ওয়াক্ত:** ${sched.current_waqt} · **পরবর্তী (${sched.next_waqt_name}):** ${sched.next_waqt_time} (${sched.countdown_bn} বাকি)। বাংলাদেশের যেকোনো ৬৪ জেলার নাম লিখে সময় জানতে পারেন (যেমন: *রাজশাহীতে ইফতার কয়টায়?* বা *সিলেটে ফজরের টাইম কখন?*)।`,
        ],
        ['আউয়াল ওয়াক্তে সালাত আদায়ের ফযীলত কী?', 'ফজরের সালাত কাযা হলে কখন পড়তে হবে?', 'চট্টগ্রামে নামাজের সময়সূচি']
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

    // 0f. All-64-District City Memory ("আমি চুয়াডাঙ্গায় থাকি")
    const statedDistrict = matchSavedDistrictOnly(q);
    if (statedDistrict) {
      try {
        const store = root.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
        if (store) {
          store.setItem('dawahx_user_city_v4', statedDistrict.id);
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('dawahx:city-changed', { detail: { cityId: statedDistrict.id } }));
        }
      } catch (_) {}
      const sched = computePrayerSchedule(statedDistrict, new Date(), userAsrMethod);
      return makeChat(
        `মাশাআল্লাহ${nameTag}! আপনি **${statedDistrict.bn}** থেকে বলছেন জেনে খুব ভালো লাগলো। আমি এটি আপনার ডিফল্ট জেলা হিসেবে সংরক্ষণ করে রাখলাম!`,
        [`প্রসঙ্গত, **${statedDistrict.bn}**-এ পরবর্তী ওয়াক্ত **${sched.next_waqt_name}** শুরু হবে **${sched.next_waqt_time}** মিনিটে। আজ কী নিয়ে আলাপ করব?`],
        [`${statedDistrict.bn} জেলার আজকের নামাজের সময়সূচি`, 'সালাতে মনোযোগ বাড়ানোর উপায় কী?']
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
        ['হতাশা ও দুশ্চিন্তা দূর করার ইসলামিক উপায় কী?', 'গুনাহ হয়ে গেলে আল্লাহর ক্ষমা পাওয়ার উপায় কী?', 'দোয়া কবুল হওয়ার উত্তম সময় কোনটি?'],
        { deterministic: false }
      );
    }

    if (lastCtx) {
      if (
        (CHAT_PATTERNS.elaborate.test(q) ||
          /(?:সহজ\s*(?:করে|ভাষায়)|সংক্ষেপে|সারসংক্ষেপ|পয়েন্ট\s*আকারে|ইংরেজিতে\s*অনুবাদ|translate\s*(?:to|into)?\s*english|summarize|simplify)/iu.test(q)) &&
        q.length <= 85
      ) {
        const paras = String(lastCtx.extra_body || '')
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 4);
        return makeChat(
          `অবশ্যই, **‘${lastCtx.primary_title}’** বিষয়ে তুলে ধরছি—`,
          paras,
          [],
          { sources: (lastCtx.sources || []).slice(0, 2), deterministic: false }
        );
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
    // Strictly augment ONLY when user explicitly uses anaphoric pronouns or continuation markers!
    // Never pollute standalone short questions ("দাড়ি রাখার হুকুম কী?", "হস্তমৈথুন কি হারাম?", "তারাবীহ নামাজ কত রাকাত?")!
    const ANAPHORA_FOLLOWUP_RE = /(?:^\s*(?:আর\s+|তাহলে\s+|এক্ষেত্রে\s+|সেক্ষেত্রে\s+|তো\s+|কিন্তু\s+)|(?:(?:^|[\s,।?!;:'"()-])(?:এটা|এটি|ওটা|সেটা|এতে|এটার|এটির|এর\s*(?:হুকুম|বিধান|দলিল|কাফফারা|নিয়ম|নিয়ম|কারণে)|তাহলে\s*কি|সেক্ষেত্রে\s*কি|এক্ষেত্রে\s*কি)(?=$|[\s,।?!;:'"()-])))/iu;
    const startsContextual = CHAT_PATTERNS.ellipsisFollowup.test(question) || ANAPHORA_FOLLOWUP_RE.test(question);
    const EVIDENCE_META_STEMS = new Set(['হাদিস', 'হাদীস', 'হাদীছ', 'কুরআন', 'কোরআন', 'আয়াত', 'সূরা', 'সুরা'].map((w) => stemBn(foldBn(w))));
    const hasOwnMandatorySubject = qCore
      .filter((st) => !(startsContextual && EVIDENCE_META_STEMS.has(st)))
      .some((st) => MANDATORY_ANCHOR_STEMS.has(st));

    if (startsContextual && !hasOwnMandatorySubject && qCore.length <= 4) {
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
    const rawBlocks = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Split very long single-div fatwa blocks (> 620 chars) cleanly at sentence boundaries so answers never truncate halfway!
    const expanded = [];
    for (const blk of rawBlocks) {
      if (blk.length <= 620) {
        expanded.push(blk);
        continue;
      }
      const sents = blk.split(/(?<=[।?!])\s+/u);
      let chunk = '';
      for (const s of sents) {
        if (!s) continue;
        if (chunk && chunk.length + s.length + 1 > 520) {
          expanded.push(chunk.trim());
          chunk = s;
        } else {
          chunk = chunk ? `${chunk} ${s}` : s;
        }
      }
      if (chunk.trim()) expanded.push(chunk.trim());
    }
    return expanded;
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
    const perParaCap = Math.max(950, Math.floor(maxChars * 0.6));
    for (const idx of chosen) {
      const p = trimCleanly(paras[idx], perParaCap);
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

  // Resilient binary/gzip & window-script parsers for DAWAH X Scripture, Hadith & Islamic Books (v22.0)
  async function fetchBytesWithFallback(relPath) {
    const key = `bin:${relPath}`;
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = (async () => {
      for (const base of [PRIMARY_BASE, FALLBACK_BASE]) {
        try {
          const r = await fetch(`${base}/${relPath}`);
          if (r.ok) return await r.arrayBuffer();
        } catch (_) {}
      }
      throw new Error(`Failed to fetch binary ${relPath}`);
    })();
    cacheMap.set(key, p);
    p.catch(() => cacheMap.delete(key));
    return p;
  }

  async function fetchGunzipJson(relPath) {
    const key = `gz:${relPath}`;
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = (async () => {
      const buf = await fetchBytesWithFallback(relPath);
      if (typeof DecompressionStream === 'function') {
        const ds = new DecompressionStream('gzip');
        const stream = new Blob([buf]).stream().pipeThrough(ds);
        return await new Response(stream).json();
      }
      throw new Error('DecompressionStream unavailable');
    })();
    cacheMap.set(key, p);
    p.catch(() => cacheMap.delete(key));
    return p;
  }

  function toPrecomposedBn(str) {
    return String(str || '')
      .normalize('NFC')
      .replace(/\u09AF\u09BC/g, '\u09DF')
      .replace(/\u09A1\u09BC/g, '\u09DC')
      .replace(/\u09A2\u09BC/g, '\u09DD');
  }

  function parseWindowScriptJson(jsText, varName) {
    const clean = String(jsText || '')
      .replace(/^\s*\/\*[\s\S]*?\*\/\s*/g, '')
      .replace(/window\.[A-Za-z0-9_]+\s*=\s*window\.[A-Za-z0-9_]+\s*\|\|\s*\{\}\s*;\s*/g, '')
      .trim();
    if (varName) {
      const re = new RegExp(`window\\.${varName}(?:\\[\\d+\\])?\\s*=\\s*`);
      const m = re.exec(clean);
      if (m) {
        const rest = clean.slice(m.index + m[0].length);
        const nextWin = rest.search(/;\s*window\.[A-Za-z0-9_]+(?:\[\d+\])?\s*=/);
        const jsonPart = (nextWin >= 0 ? rest.slice(0, nextWin) : rest).trim().replace(/;\s*$/, '');
        return JSON.parse(jsonPart);
      }
    }
    const generic = clean.match(/^window\.[A-Za-z0-9_]+(?:\[\d+\])?\s*=\s*([\s\S]+)$/);
    if (generic) {
      return JSON.parse(generic[1].trim().replace(/;\s*$/, ''));
    }
    throw new Error(`Unable to parse window.${varName || 'script'}`);
  }

  function stripHtmlClean(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }

  function parseBnOrAsciiInt(str) {
    if (str == null) return NaN;
    const ascii = String(str).replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^\d]/g, '');
    return ascii ? parseInt(ascii, 10) : NaN;
  }

  // =========================================================================
  // v22.0 Module A: DAWAH X Site Info, Policy, Contact & 102-Volume Islamic Books
  // =========================================================================
  const ISLAMIC_BOOK_COLLECTIONS_META = [
    {
      id: 'bidaya',
      name: 'আল-বিদায়া ওয়ান নিহায়া',
      author: 'ইমাম ইবনে কাসীর (রহ.) · ইসলামিক ফাউন্ডেশন অনুবাদ',
      volumes: 14,
      category: 'ইসলামের ইতিহাস ও সীরাত',
      re: /(?:আল[\s\-]*বিদা(?:য়|য়)া|বিদা(?:য়|য়)া\s*ও(?:য়|য়)ান\s*নিহা(?:য়|য়)া|al[\s\-]*bidaya|wan[\s\-]*nihaya)/iu,
      desc: 'সৃষ্টির সূচনা, নবীদের ইতিহাস, সীরাতুন্নবী (ﷺ), খিলাফতে রাশেদা থেকে শুরু করে ইসলামের প্রামাণ্য ইতিহাস ও কিয়ামতের আলামত পর্যন্ত ১৪ খণ্ডের বিশ্ববিখ্যাত ইতিহাসগ্রন্থ।',
    },
    {
      id: 'ibnkathir',
      name: 'তাফসীরে ইবনে কাসীর',
      author: 'হাফেয ইমাদুদ্দীন ইবনে কাসীর (রহ.) · ইসলামিক ফাউন্ডেশন',
      volumes: 21,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাফস[ীি]র[ে]?\s*ইবন[েু]?\s*কাস[ীি]র|ইবন[েু]?\s*কাস[ীি]র(?:ের)?\s*(?:তাফস[ীি]র|বই|খণ্ড|খন্ড|পিডিএফ|pdf)|tafsir[e]?\s*ibn\s*ka(?:th|s)ir)/iu,
      desc: 'কুরআন ও সহীহ হাদীসের আলোকে কুরআনের সর্বজনস্বীকৃত ও সর্বাধিক নির্ভরযোগ্য তাফসীর গ্রন্থ (ইসলামিক ফাউন্ডেশন সংস্করণ, মোট ২১ খণ্ড)।',
    },
    {
      id: 'zilal',
      name: 'তাফসীর ফী যিলালিল কুরআন',
      author: 'সাইয়্যেদ কুতুব (রহ.)',
      volumes: 22,
      category: 'কুরআনের তাফসীর',
      re: /(?:ফ[ীি]\s*[যজ]িলালিল\s*কুরআন|[যজ]িলালিল\s*কুরআন|zilalil\s*quran|fi\s*zilal)/iu,
      desc: 'কুরআনের জীবনঘনিষ্ঠ দাওয়াতী ও সাহিত্যিক তাফসীর সংকলন (মোট ২২ খণ্ড)।',
    },
    {
      id: 'usmani',
      name: 'তাফসীরে উসমানী',
      author: 'আল্লামা শাব্বীর আহমদ উসমানী (রহ.)',
      volumes: 3,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাফস[ীি]র[ে]?\s*উসমান[ীি]|তাফস[ীি]র[ে]?\s*ওসমান[ীি]|tafsir[e]?\s*usmani)/iu,
      desc: 'সংক্ষিপ্ত ও প্রাঞ্জল ভাষায় কুরআনুল কারীমের প্রসিদ্ধ তাফসীর গ্রন্থ (মোট ৩ খণ্ড)।',
    },
    {
      id: 'jalalain',
      name: 'তাফসীরে জালালাইন',
      author: 'ইমাম জালালুদ্দীন মহল্লী ও ইমাম জালালুদ্দীন সুয়ূতী (রহ.)',
      volumes: 7,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাফস[ীি]র[ে]?\s*জালালাইন|জালালাইন\s*শর[ীি]ফ|tafsir[e]?\s*jalalain)/iu,
      desc: 'মাদরাসা ও ইলমী অঙ্গনে বহুল পঠিত সংক্ষিপ্ত ও সারগর্ভ তাফসীর গ্রন্থ (মোট ৭ খণ্ড)।',
    },
    {
      id: 'maarif',
      name: 'তাফসীরে মাআরেফুল কুরআন',
      author: 'মুফতী মুহাম্মাদ শফী (রহ.)',
      volumes: 8,
      category: 'কুরআনের তাফসীর',
      re: /(?:মা.?আরেফুল\s*কুরআন|মারেফুল\s*কুরআন|maariful\s*quran|maareful\s*quran)/iu,
      desc: 'ফিকহী মাসআলা ও আধুনিক জীবনঘনিষ্ঠ ব্যাখ্যাসমৃদ্ধ পূর্ণাঙ্গ তাফসীর গ্রন্থ (মোট ৮ খণ্ড)।',
    },
    {
      id: 'tawjih',
      name: 'তাফসীরে তাওযীহুল কুরআন',
      author: 'শায়খুল ইসলাম মুফতী তকী উসমানী',
      volumes: 3,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাও[যজ][ীি]হুল\s*কুরআন|tawjihul\s*quran|taozihul\s*quran)/iu,
      desc: 'সাধারণ পাঠকদের জন্য অত্যন্ত সহজ ও সাবলীল ভাষায় রচিত সংক্ষিপ্ত তাফসীর ও অনুবাদ (মোট ৩ খণ্ড)।',
    },
    {
      id: 'tabari',
      name: 'তাফসীরে তাবারী শরীফ',
      author: 'ইমাম ইবনু জারীর আত-তাবারী (রহ.)',
      volumes: 10,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাফস[ীি]র[ে]?\s*তাবার[ীি]|তাবার[ীি]\s*শর[ীি]ফ|tafsir[e]?\s*tabari)/iu,
      desc: 'সালাফে সালেহীনের বর্ণনাভিত্তিক প্রাচীনতম ও মৌলিক তাফসীর গ্রন্থসমূহের অন্যতম (বাংলা অনুবাদ, ১০ খণ্ড)।',
    },
    {
      id: 'mazhari',
      name: 'তাফসীরে মাযহারী',
      author: 'কাযী ছানাউল্লাহ পানিপথী (রহ.)',
      volumes: 12,
      category: 'কুরআনের তাফসীর',
      re: /(?:তাফস[ীি]র[ে]?\s*মা[যজ]হার[ীি]|tafsir[e]?\s*mazhari)/iu,
      desc: 'হাদীস ও ফিকহী মাসআলার বিস্তারিত আলোচনাসমৃদ্ধ তাফসীর গ্রন্থ (মোট ১২ খণ্ড)।',
    },
    {
      id: 'ahmad',
      name: 'মুসনাদে আহমদ',
      author: 'ইমাম আহমাদ ইবনু হাম্বল (রহ.)',
      volumes: 2,
      category: 'হাদীস সংকলন (বই সংস্করণ)',
      re: /(?:মুসনাদ[ে]?\s*আহম[াদ]?দ|musnad[e]?\s*ahmad)/iu,
      desc: 'ইমাম আহমাদ ইবনু হাম্বল (রহ.) সংকলিত সুপ্রসিদ্ধ হাদীস গ্রন্থের বাংলা বই সংস্করণ (২ খণ্ড)।',
    },
  ];

  async function getIslamicBooksCatalog() {
    const key = 'parsed:islamic-books-catalog';
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = fetchWithFallback('islamic-books-catalog.js', true)
      .then((txt) => parseWindowScriptJson(txt, 'ISLAMIC_BOOKS'))
      .catch(() => null);
    cacheMap.set(key, p);
    return p;
  }

  async function resolveDawahXSiteAndBooks(question, engine, t0) {
    const q = String(question || '').trim();
    const mentionsDawahX = /(?:dawah\s*[-_]?x|দাওয়াহ?\s*এক্স|(?:এই|আপনাদের|তোমাদের)\s*(?:ওয়েবসাইট|সাইট|প্ল্যাটফর্ম))/iu.test(q);
    const asksBookAction = /(?:বই|কিতাব|গ্রন্থ|খণ্ড|খন্ড|পিডিএফ|pdf|পড়ব|পড়া\s*যাবে|কোথায়\s*পাব|ডাউনলোড|আছে\s*কি|কয়\s*খণ্ড|কয়টি\s*খণ্ড|লাইব্রেরি|গ্রন্থাগার|সংগ্রহ)/iu.test(q);

    // 1. Specific Islamic Book Collection query (e.g., "আল বিদায়া ওয়ান নিহায়া বইটি কোথায় পড়তে পারব?")
    const matchedBookMeta = ISLAMIC_BOOK_COLLECTIONS_META.find((b) => b.re.test(q));
    if (matchedBookMeta && (asksBookAction || mentionsDawahX || q.length <= 52)) {
      const catalog = await getIslamicBooksCatalog();
      const liveGroup = Array.isArray(catalog) ? catalog.find((g) => g.id === matchedBookMeta.id) : null;
      const items = (liveGroup && Array.isArray(liveGroup.items)) ? liveGroup.items : [];
      const volCount = items.length || matchedBookMeta.volumes;
      const collectionUrl = `${SITE_URL}/islamic-book-collection.html?collection=${encodeURIComponent(matchedBookMeta.id)}`;

      // Check if user requested a specific volume number (e.g. "৩য় খণ্ড" / "vol 2")
      const volMatch = q.match(/([০-৯0-9]{1,2})\s*(?:ম|য়|য়|র্থ|ষ্ঠ|তম|\s*নং)?\s*(?:খণ্ড|খন্ড|ভলিউম|part|vol)/iu);
      const reqVol = volMatch ? parseBnOrAsciiInt(volMatch[1]) : NaN;
      const targetItem = (!isNaN(reqVol) && reqVol >= 1 && reqVol <= items.length) ? items[reqVol - 1] : items[0];
      const firstReadUrl = targetItem
        ? `${SITE_URL}/islamic-book-read.html?book=${encodeURIComponent(targetItem.id)}`
        : collectionUrl;

      const volListText = items.length
        ? items.slice(0, 8).map((it, idx) => `• খণ্ড ${toBnDigitsStr(idx + 1)}: ${it.name.replace(/\s*pdf\s*$/i, '')}`).join('\n') +
          (items.length > 8 ? `\n• … এবং আরও ${toBnDigitsStr(items.length - 8)}টি খণ্ড (মোট ${toBnDigitsStr(volCount)} খণ্ড)` : '')
        : `মোট খণ্ড সংখ্যা: ${toBnDigitsStr(volCount)}টি খণ্ড।`;

      const fullReaderBody = `${matchedBookMeta.name} (${matchedBookMeta.author})\nবিভাগ: ${matchedBookMeta.category}\nমোট খণ্ড: ${toBnDigitsStr(volCount)}টি\n\nপরিচিতি:\n${matchedBookMeta.desc}\n\nঅন্তর্ভুক্ত খণ্ডসমূহ:\n${volListText}\n\nDAWAH X গ্রন্থাগার লিংক: ${collectionUrl}`;

      const srcCards = [
        {
          rank: 1,
          key: `book_${matchedBookMeta.id}`,
          title: `${matchedBookMeta.name} (মোট ${toBnDigitsStr(volCount)} খণ্ড)`,
          clean_title: `${matchedBookMeta.name} — সম্পূর্ণ ${toBnDigitsStr(volCount)} খণ্ডের সংগ্রহ`,
          source_code: 'dx_books',
          source_name: 'DAWAH X ইসলামিক বই গ্রন্থাগার',
          category: matchedBookMeta.category,
          doc_type: 'book',
          dawahx_url: collectionUrl,
          share_url: collectionUrl,
          confidence: 0.99,
          excerpt: matchedBookMeta.desc,
          full_text: fullReaderBody,
        },
      ];
      if (targetItem) {
        srcCards.push({
          rank: 2,
          key: `book_item_${targetItem.id}`,
          title: targetItem.name.replace(/\s*pdf\s*$/i, ''),
          clean_title: targetItem.name.replace(/\s*pdf\s*$/i, ''),
          source_code: 'dx_books',
          source_name: 'DAWAH X বুক রিডার',
          category: 'সরাসরি পাঠযোগ্য খণ্ড',
          doc_type: 'book',
          dawahx_url: firstReadUrl,
          share_url: firstReadUrl,
          confidence: 0.98,
          excerpt: `${matchedBookMeta.name}-এর এই খণ্ডটি DAWAH X-এর ইন্টারেক্টিভ বুক রিডারে সরাসরি পড়ুন।`,
          full_text: fullReaderBody,
        });
      }

      const ragCtx = [
        {
          citation: `[1] ${matchedBookMeta.name} (মোট ${toBnDigitsStr(volCount)} খণ্ড) — DAWAH X ইসলামিক বই (${collectionUrl})`,
          content: `${fullReaderBody}\nপ্রথম/নির্বাচিত খণ্ড পড়ার সরাসরি লিংক: ${firstReadUrl}`,
        },
      ];

      return {
        status: 'answered',
        is_chat: false,
        is_verbatim_card: true,
        query: question,
        headline: `${matchedBookMeta.name} — DAWAH X ইসলামিক বই গ্রন্থাগার (${toBnDigitsStr(volCount)} খণ্ড)`,
        primary_source: 'dx_books',
        primary_source_code: 'dx_books',
        primary_source_name: 'DAWAH X ইসলামিক বই গ্রন্থাগার',
        primary_doc_type: 'book',
        direct_answer: `জি, আলহামদুলিল্লাহ! **${matchedBookMeta.name}** (${matchedBookMeta.author}) সম্পূর্ণ **${toBnDigitsStr(volCount)} খণ্ডে** **DAWAH X**-এর ইসলামিক বই বিভাগে বিনামূল্যে অনলাইনে পড়ার জন্য যুক্ত রয়েছে।`,
        explanation_paragraphs: [
          matchedBookMeta.desc,
          `আপনি নিচের উৎস কার্ড থেকে সরাসরি **DAWAH X ইসলামিক বই সংগ্রহ** পাতায় গিয়ে যেকোনো খণ্ড খুলে পৃষ্ঠা উল্টে (ফ্লিপবুক ও পিডিএফ ভিউয়ারে) পড়তে পারবেন:\n${volListText}`,
        ],
        additional_perspectives: [],
        evidences: [],
        sources: srcCards,
        videos: [],
        follow_ups: [
          'DAWAH X ওয়েবসাইটে আর কী কী ইসলামিক বই ও তাফসীর আছে?',
          'DAWAH X এ কয়টি হাদীস গ্রন্থ রয়েছে?',
          'DAWAH X ওয়েবসাইটে নতুন কী কী যুক্ত হয়েছে?',
        ],
        rag_context: ragCtx,
        confidence: 0.99,
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        ask_team_url: `${SITE_URL}/ask.html`,
      };
    }

    // 2. General Islamic Books / Tafsir Catalog query on DAWAH X
    if (
      (mentionsDawahX && /(?:বই|কিতাব|তাফস[ীি]র|গ্রন্থাগার|লাইব্রেরি|পিডিএফ|books?)/iu.test(q)) ||
      /(?:কুরআনের?\s*তাফস[ীি]রের?\s*ক[ীি]\s*ক[ীি]\s*বই|ক[ীি]\s*ক[ীি]\s*(?:ইসলামিক\s*)?(?:বই|তাফস[ীি]র\s*গ্রন্থ)\s*(?:আছে|পাওয়া\s*যাবে|পড়া\s*যাবে))/iu.test(q)
    ) {
      const lines = ISLAMIC_BOOK_COLLECTIONS_META.map(
        (b, i) => `${toBnDigitsStr(i + 1)}. **${b.name}** — ${toBnDigitsStr(b.volumes)} খণ্ড (${b.category})`
      ).join('\n');
      const booksUrl = `${SITE_URL}/islamic-books.html`;
      const fullCatalogText = `DAWAH X ইসলামিক বই গ্রন্থাগার (১০টি সংগ্রহে মোট ১০২ খণ্ড):\n\n${lines}\n\nসরাসরি পড়ার ঠিকানা: ${booksUrl}`;
      const srcCards = [
        {
          rank: 1,
          key: 'dx_islamic_books_all',
          title: 'DAWAH X ইসলামিক বই ও তাফসীর গ্রন্থাগার (১০টি সংগ্রহে ১০২ খণ্ড)',
          clean_title: 'DAWAH X ইসলামিক বই ও তাফসীর গ্রন্থাগার (১০টি সংগ্রহে ১০২ খণ্ড)',
          source_code: 'dx_books',
          source_name: 'DAWAH X ইসলামিক বই',
          category: 'তাফসীর, ইতিহাস ও হাদীস গ্রন্থ',
          doc_type: 'book',
          dawahx_url: booksUrl,
          share_url: booksUrl,
          confidence: 0.99,
          excerpt: 'তাফসীরে ইবনে কাসীর, আল-বিদায়া ওয়ান নিহায়া, মাআরেফুল কুরআন, তাবারী, জালালাইন, মাযহারী, উসমানী, তাওযীহুল কুরআন, ফী যিলালিল কুরআন ও মুসনাদে আহমদ।',
          full_text: fullCatalogText,
        },
      ];
      return {
        status: 'answered',
        is_chat: false,
        is_verbatim_card: true,
        query: question,
        headline: 'DAWAH X ইসলামিক বই ও তাফসীর গ্রন্থাগার (১০টি সংগ্রহে ১০২ খণ্ড)',
        primary_source: 'dx_books',
        primary_source_code: 'dx_books',
        primary_source_name: 'DAWAH X ইসলামিক বই',
        primary_doc_type: 'book',
        direct_answer: 'আলহামদুলিল্লাহ! **DAWAH X**-এর নতুন **ইসলামিক বই (Islamic Books)** বিভাগে বর্তমানে **১০টি বৃহৎ সংগ্রহে মোট ১০২ খণ্ড** প্রামাণ্য তাফসীর, ইতিহাস ও হাদীস গ্রন্থ সরাসরি অনলাইনে পড়ার ব্যবস্থা রয়েছে:',
        explanation_paragraphs: [
          lines,
          'এর পাশাপাশি **আল-কুরআন** পাতায় ড. আবু বকর মুহাম্মাদ যাকারিয়ার পূর্ণাঙ্গ অনুবাদ ও তাফসীর (১১৪ সূরা) এবং **আল-হাদীস** পাতায় ২৮টি হাদীস গ্রন্থ (৬১,৯১০টি হাদীস) অধ্যায় ও নম্বরসহ যুক্ত রয়েছে।',
        ],
        additional_perspectives: [],
        evidences: [],
        sources: srcCards,
        videos: [],
        follow_ups: [
          'তাফসীরে ইবনে কাসীর কয় খণ্ডে আছে?',
          'আল বিদায়া ওয়ান নিহায়া বইটি কোথায় পড়তে পারব?',
          'DAWAH X এ কয়টি হাদীস গ্রন্থ আছে?',
        ],
        rag_context: [
          {
            citation: `[1] DAWAH X ইসলামিক বই ও তাফসীর গ্রন্থাগার — ${booksUrl}`,
            content: fullCatalogText,
          },
        ],
        confidence: 0.99,
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        ask_team_url: `${SITE_URL}/ask.html`,
      };
    }

    // 3. DAWAH X Site Metadata: Founder, Contact/WhatsApp, Policy, Hadith Stats, Website Features
    if (mentionsDawahX || /(?:ইবরাহ[ীি]ম\s*ঈদ|ebrahim\s*ead)/iu.test(q)) {
      const st = (engine && engine.stats) || {};
      const totalTexts = st.texts || 24207;
      const totalFatwas = st.fatwas || 15878;
      const totalArticles = st.articles || 6937;
      const totalQuestions = st.questions || 929;
      const totalVideos = st.videos || 9333;

      // 3a. Contact / WhatsApp / Ask Question
      if (/(?:যোগাযোগ|ফোন|নম্বর|নাম্বার|হোয়াটসঅ্যাপ|whatsapp|contact|প্রশ্ন\s*পাঠা|কীভাবে\s*প্রশ্ন\s*করব)/iu.test(q)) {
        const contactUrl = `${SITE_URL}/contact.html`;
        const askUrl = `${SITE_URL}/ask.html`;
        const contactBody = `DAWAH X যোগাযোগ ও প্রশ্ন পাঠানোর মাধ্যম:\n• ফোন ও WhatsApp নম্বর: 01783543026 (প্রতিদিন সকাল ১০:০০টা থেকে রাত ১০:০০টা)\n• পরিচালনা ও তত্ত্বাবধান: ইবরাহীম ঈদ (Ebrahim Ead / Ebrahim Bin Kamruzzaman)\n• অনলাইনে প্রশ্ন পাঠানোর ফর্ম: ${askUrl}\n• যোগাযোগ পাতা: ${contactUrl}`;
        return {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'DAWAH X-এ যোগাযোগ ও প্রশ্ন পাঠানোর মাধ্যম',
          primary_source: 'dx_site',
          primary_source_code: 'dx_site',
          primary_source_name: 'DAWAH X পরিচিতি ও যোগাযোগ',
          primary_doc_type: 'article',
          direct_answer: '**DAWAH X**-এর সাথে যোগাযোগ অথবা কোনো শারঈ ও দাওয়াতী প্রশ্ন পাঠাতে নিচের অফিসিয়াল মাধ্যমগুলো ব্যবহার করতে পারেন:\n\n• **ফোন ও WhatsApp:** `01783543026` *(প্রতিদিন সকাল ১০:০০টা – রাত ১০:০০টা)*\n• **অনলাইনে প্রশ্ন প্রেরণ:** DAWAH X-এর **প্রশ্ন করুন (`ask.html`)** পাতার মাধ্যমে সরাসরি প্রশ্ন পাঠানো যায়।',
          explanation_paragraphs: [
            'প্ল্যাটফর্মটি পরিচালনা ও তত্ত্বাবধান করছেন **ইবরাহীম ঈদ (Ebrahim Ead / Ebrahim Bin Kamruzzaman)**। কোনো তথ্য বা রেফারেন্সে মুদ্রণজনিত ত্রুটি নজরে এলে প্রমাণসহ যোগাযোগ পাতার মাধ্যমে জানালে তা অগ্রাধিকার ভিত্তিতে যাচাই করে সংশোধন করা হয়।',
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_contact_page',
              title: 'যোগাযোগ ও প্রশ্ন প্রেরণ — DAWAH X',
              clean_title: 'যোগাযোগ ও প্রশ্ন প্রেরণ — DAWAH X',
              source_code: 'dx_site',
              source_name: 'DAWAH X অফিসিয়াল পাতা',
              category: 'যোগাযোগ',
              doc_type: 'article',
              dawahx_url: contactUrl,
              share_url: contactUrl,
              confidence: 1.0,
              excerpt: 'ফোন ও WhatsApp: 01783543026 (সকাল ১০টা – রাত ১০টা) · অনলাইন প্রশ্ন ফর্ম।',
              full_text: contactBody,
            },
            {
              rank: 2,
              key: 'dx_ask_page',
              title: 'প্রশ্ন করুন — DAWAH X',
              clean_title: 'প্রশ্ন করুন — DAWAH X',
              source_code: 'dx_site',
              source_name: 'DAWAH X প্রশ্নোত্তর বিভাগ',
              category: 'প্রশ্ন প্রেরণ',
              doc_type: 'article',
              dawahx_url: askUrl,
              share_url: askUrl,
              confidence: 0.99,
              excerpt: 'আপনার জিজ্ঞাসা সরাসরি DAWAH X টিমের কাছে পাঠান।',
              full_text: contactBody,
            },
          ],
          videos: [],
          follow_ups: [
            'DAWAH X এর উৎস ও সংশোধন নীতি কী?',
            'DAWAH X ওয়েবসাইট কে পরিচালনা করেন?',
            'DAWAH X ওয়েবসাইটে নতুন কী কী যুক্ত হয়েছে?',
          ],
          rag_context: [{ citation: `[1] যোগাযোগ — DAWAH X (${contactUrl})`, content: contactBody }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: askUrl,
        };
      }

      // 3b. Founder / Who runs DAWAH X
      if (/(?:কে\s*পরিচালনা|প্রতিষ্ঠাতা|কে\s*তৈরি|কে\s*বানিয়েছে|পরিচালক|কার\s*ওয়েবসাইট|ইবরাহ[ীি]ম\s*ঈদ|ebrahim\s*ead|founder|owner|about)/iu.test(q)) {
        const aboutUrl = `${SITE_URL}/about.html`;
        const aboutBody = `DAWAH X পরিচিতি:\n• পরিচালনা ও সংকলন: ইবরাহীম ঈদ (Ebrahim Ead / Ebrahim Bin Kamruzzaman)\n• লক্ষ্য ও উদ্দেশ্য: কুরআন, সহীহ হাদীস, নির্ভরযোগ্য ফতোয়া, প্রামাণ্য তাফসীর ও আধুনিক সংশয়ের দলিলভিত্তিক জবাব সম্পূর্ণ বিজ্ঞাপনমুক্ত ও অলাভজনকভাবে বাংলা ভাষাভাষী পাঠকদের কাছে পৌঁছে দেওয়া।\n• যোগাযোগ (ফোন ও WhatsApp): 01783543026`;
        return {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'DAWAH X পরিচিতি ও পরিচালনা',
          primary_source: 'dx_site',
          primary_source_code: 'dx_site',
          primary_source_name: 'DAWAH X পরিচিতি',
          primary_doc_type: 'article',
          direct_answer: '**DAWAH X** প্ল্যাটফর্মটি পরিচালনা ও তত্ত্বাবধান করছেন **ইবরাহীম ঈদ (Ebrahim Ead / Ebrahim Bin Kamruzzaman)**। এটি একটি সম্পূর্ণ বিজ্ঞাপনমুক্ত ও অলাভজনক ইসলামী জ্ঞান ও দাওয়াহ প্ল্যাটফর্ম।',
          explanation_paragraphs: [
            `এই প্ল্যাটফর্মে আল-কুরআন (অনুবাদ ও তাফসীর), ২৮টি হাদীস গ্রন্থের ৬১,৯১০টি হাদীস, ১০টি সংগ্রহে ১০২ খণ্ডের ইসলামিক বই, ${toBnDigitsStr(totalTexts)}টি প্রামাণ্য ফতোয়া ও প্রবন্ধ এবং ${toBnDigitsStr(totalVideos)}টিরও বেশি ইসলামিক ভিডিও সুবিন্যস্তভাবে সংরক্ষিত রয়েছে।`,
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_about_page',
              title: 'আমাদের সম্পর্কে — DAWAH X',
              clean_title: 'আমাদের সম্পর্কে — DAWAH X',
              source_code: 'dx_site',
              source_name: 'DAWAH X অফিসিয়াল পাতা',
              category: 'পরিচিতি',
              doc_type: 'article',
              dawahx_url: aboutUrl,
              share_url: aboutUrl,
              confidence: 1.0,
              excerpt: 'পরিচালনায়: ইবরাহীম ঈদ (Ebrahim Ead) — বিজ্ঞাপনমুক্ত ইসলামী দাওয়াহ ও গবেষণা সংকলন।',
              full_text: aboutBody,
            },
          ],
          videos: [],
          follow_ups: [
            'DAWAH X ওয়েবসাইটে নতুন কী কী যুক্ত হয়েছে?',
            'DAWAH X এ কীভাবে যোগাযোগ করা যাবে?',
            'DAWAH X এর উৎস ও সংশোধন নীতি কী?',
          ],
          rag_context: [{ citation: `[1] আমাদের সম্পর্কে — DAWAH X (${aboutUrl})`, content: aboutBody }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      // 3c. Editorial, Source & Correction Policy
      if (/(?:নীতি|নীতিমালা|সংশোধন|পলিসি|policy|বিজ্ঞাপন|স্পন্সর|উৎস\s*নীতি)/iu.test(q)) {
        const policyUrl = `${SITE_URL}/policy.html`;
        const policyBody = `DAWAH X উৎস ও সংশোধন নীতিমালা:\n১. মূল উৎস সংরক্ষণ: প্রতিটি ফতোয়া, প্রবন্ধ, কুরআনের তাফসীর ও হাদীস মূল প্রকাশনা ও প্রামাণ্য রেফারেন্স উল্লেখসহ সংরক্ষণ করা হয়।\n২. বিজ্ঞাপন ও স্পন্সরমুক্ত: DAWAH X সম্পূর্ণ বিজ্ঞাপনমুক্ত (Ad-free) এবং কোনো বাণিজ্যিক স্পন্সরশিপ গ্রহণ করে না।\n৩. সংশোধন নীতি: কোনো লেখায় বানান, রেফারেন্স বা তথ্যগত ত্রুটি প্রমাণসহ জানানো হলে ৭ কর্মদিবসের (7 working days) মধ্যে তা যাচাই করে সংশোধন করা হয়।`;
        return {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'DAWAH X-এর উৎস ও সংশোধন নীতিমালা',
          primary_source: 'dx_site',
          primary_source_code: 'dx_site',
          primary_source_name: 'DAWAH X নীতিমালা',
          primary_doc_type: 'article',
          direct_answer: '**DAWAH X**-এর উৎস ও সম্পাদনা নীতিমালা তিনটি মূল স্তম্ভের ওপর প্রতিষ্ঠিত:\n\n• **সুস্পষ্ট মূল উৎস:** প্রতিটি ফতোয়া, প্রবন্ধ, আয়াত ও হাদীস মূল গ্রন্থ ও প্রামাণ্য প্রকাশনার সূত্রসহ উপস্থাপন করা হয়।\n• **বিজ্ঞাপন ও স্পন্সরমুক্ত:** প্ল্যাটফর্মটি সম্পূর্ণ অলাভজনক ও বিজ্ঞাপনমুক্ত।\n• **দ্রুত সংশোধন নীতি:** কোনো তথ্য বা রেফারেন্সে ত্রুটি প্রমাণসহ জানালে **৭ কর্মদিবসের** মধ্যে তা যাচাই করে সংশোধন করা হয়।',
          explanation_paragraphs: [],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_policy_page',
              title: 'উৎস ও সংশোধন নীতি — DAWAH X',
              clean_title: 'উৎস ও সংশোধন নীতি — DAWAH X',
              source_code: 'dx_site',
              source_name: 'DAWAH X নীতিমালা',
              category: 'নীতিমালা',
              doc_type: 'article',
              dawahx_url: policyUrl,
              share_url: policyUrl,
              confidence: 1.0,
              excerpt: 'মূল সূত্র সংরক্ষণ, বিজ্ঞাপনমুক্ত সেবা এবং ৭ কর্মদিবসের মধ্যে তথ্য যাচাই ও সংশোধন।',
              full_text: policyBody,
            },
          ],
          videos: [],
          follow_ups: [
            'DAWAH X এ কীভাবে যোগাযোগ বা প্রশ্ন করব?',
            'DAWAH X ওয়েবসাইটে নতুন কী কী যুক্ত হয়েছে?',
          ],
          rag_context: [{ citation: `[1] উৎস ও সংশোধন নীতি — DAWAH X (${policyUrl})`, content: policyBody }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      // 3d. Hadith Library count / books on DAWAH X
      if (/(?:হাদ[ীি]স).*(?:কয়টি|কতটি|কতগুলো|ক[ীি]\s*ক[ীি]|গ্রন্থ|সংগ্রহ|বই)/iu.test(q)) {
        const hadithUrl = `${SITE_URL}/hadith.html`;
        const hBody = `DAWAH X আল-হাদীস গ্রন্থাগার:\n• মোট হাদীস গ্রন্থ: ২৮টি পৃথক সংগ্রহ\n• মোট হাদীস রেকর্ড: ৬১,৯১০টি (৪০,২৮৭টি হাদীসে তাৎক্ষণিক বাংলা ও আরবি সার্চ সুবিধা)\n• প্রধান গ্রন্থসমূহ: সহীহ বুখারী (৭,৫৪৬), সহীহ মুসলিম (৭,৪৫২), সুনানে নাসাঈ (৫,৭৫৮), সুনানে আবু দাউদ (৫,২৭৪), জামে তিরমিজি (৩,৯৪১), সুনানে ইবনে মাজাহ (৪,৩৪১), মিশকাতুল মাসাবিহ (৬,০৩৭), রিয়াদুস সালেহীন (১,৯০৫), বুলুগুল মারাম (১,৫৬৮), মুয়াত্তা ইমাম মালিক (১,৮৩০), আল-লু'লু ওয়াল মারজান (১,৯০৬), আল-আদাবুল মুফরাদ (১,৩৩৬), শামায়েলে তিরমিযি (৩২২), সহীহ আত-তারগিব (২০০), সহীহ হাদীসে কুদসী (১৬৩), সহিহ ফাযায়েলে আমল (১৫১), ১০০ সুসাব্যস্ত হাদীস (১০১), সিলসিলা সহিহা (৬০), জুজউল রাফায়েল ইয়াদাইন (৪৮), আন্-নওয়াবীর চল্লিশ হাদীস (৪২), হাদীস সম্ভার (২,০১৩), সুনান আদ-দারেমী (৩,৫৪২) ও যঈফ-জাল হাদীস সতর্কীকরণ সিরিজ।`;
        return {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'DAWAH X হাদীস গ্রন্থাগার — ২৮টি গ্রন্থে ৬১,৯১০টি হাদীস',
          primary_source: 'dx_hadith',
          primary_source_code: 'dx_hadith',
          primary_source_name: 'DAWAH X আল-হাদীস',
          primary_doc_type: 'hadith',
          direct_answer: 'আলহামদুলিল্লাহ! **DAWAH X**-এর **আল-হাদীস (`hadith.html`)** বিভাগে বর্তমানে **২৮টি পৃথক হাদীস গ্রন্থে মোট ৬১,৯১০টি হাদীস** আরবি মূলপাঠ, বাংলা অনুবাদ, অধ্যায় ও তাহকীক (মান) সহ যুক্ত রয়েছে।',
          explanation_paragraphs: [
            'প্রধান গ্রন্থগুলোর মধ্যে রয়েছে: **সহীহ বুখারী** (৭,৫৪৬), **সহীহ মুসলিম** (৭,৪৫২), **সুনানে নাসাঈ** (৫,৭৫৮), **সুনানে আবু দাউদ** (৫,২৭৪), **জামে তিরমিজি** (৩,৯৪১), **সুনানে ইবনে মাজাহ** (৪,৩৪১), **মিশকাতুল মাসাবিহ** (৬,০৩৭), **রিয়াদুস সালেহীন** (১,৯০৫), **বুলুগুল মারাম** (১,৫৬৮), **মুয়াত্তা ইমাম মালিক** (১,৮৩০), **আল-লু\'লু ওয়াল মারজান** (১,৯০৬), **আল-আদাবুল মুফরাদ** (১,৩৩৬), **শামায়েলে তিরমিযি** (৩২২), **সহীহ হাদীসে কুদসী** (১৬৩), **নববীর চল্লিশ হাদীস** (৪২) এবং **সিলসিলা সহিহা** (৬০)।',
            'আপনি যেকোনো গ্রন্থের নাম ও হাদীস নম্বর লিখে আমাকে জিজ্ঞেস করলেও আমি সরাসরি DAWAH X থেকে হাদীসটি বের করে দেখাতে পারব ইনশাআল্লাহ!',
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_hadith_library',
              title: 'হাদীসের গ্রন্থসমূহ (২৮টি সংগ্রহে ৬১,৯১০টি হাদীস) — DAWAH X',
              clean_title: 'হাদীসের গ্রন্থসমূহ (২৮টি সংগ্রহে ৬১,৯১০টি হাদীস) — DAWAH X',
              source_code: 'dx_hadith',
              source_name: 'DAWAH X আল-হাদীস',
              category: 'হাদীস গ্রন্থাগার',
              doc_type: 'hadith',
              dawahx_url: hadithUrl,
              share_url: hadithUrl,
              confidence: 1.0,
              excerpt: 'সিহাহ সিত্তাহ, মিশকাত, রিয়াদুস সালেহীন, বুলুগুল মারাম, মুয়াত্তা মালিক, আদাবুল মুফরাদসহ ২৮টি গ্রন্থ।',
              full_text: hBody,
            },
          ],
          videos: [],
          follow_ups: [
            'সহীহ বুখারীর ১ নম্বর হাদীসটি আরবি ও বাংলা অর্থসহ বলো',
            'নববীর চল্লিশ হাদীসের ১ম হাদীসটি কী?',
            'DAWAH X এ কী কী ইসলামিক বই ও তাফসীর আছে?',
          ],
          rag_context: [{ citation: `[1] হাদীসের গ্রন্থসমূহ — DAWAH X (${hadithUrl})`, content: hBody }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      // 3e. General DAWAH X Overview / What's New / Sections / Services
      if (/(?:নতুন\s*ক[ীি]|ক[ীি]\s*ক[ীি]\s*(?:আছে|বিভাগ|যুক্ত|সেবা|ফিচার)|সম্পর্কে\s*বল|পরিচিতি|কী\s*ধরনের\s*ওয়েবসাইট|services|features|sections)/iu.test(q)) {
        const overviewBody = `DAWAH X ওয়েবসাইটের সকল বিভাগ ও নতুন সংযোজন:\n১. আল-কুরআন (${SITE_URL}/quran.html): পূর্ণাঙ্গ ১১৪টি সূরা, ৬,২৩৬টি আয়াতের উসমানী আরবি পাঠ, ড. আবু বকর মুহাম্মাদ যাকারিয়ার বাংলা অনুবাদ ও বিস্তারিত তাফসীর এবং ইংরেজি অনুবাদ।\n২. আল-হাদীস (${SITE_URL}/hadith.html): সিহাহ সিত্তাহ, মিশকাত, রিয়াদুস সালেহীন, বুলুগুল মারামসহ ২৮টি গ্রন্থে মোট ৬১,৯১০টি হাদীস ও তাৎক্ষণিক সার্চ।\n৩. ইসলামিক বই (${SITE_URL}/islamic-books.html): তাফসীরে ইবনে কাসীর (২১ খণ্ড), আল-বিদায়া ওয়ান নিহায়া (১৪ খণ্ড), ফী যিলালিল কুরআন (২২ খণ্ড), মাযহারী (১২ খণ্ড), তাবারী (১০ খণ্ড), মাআরেফুল কুরআন (৮ খণ্ড), জালালাইন (৭ খণ্ড), উসমানী (৩ খণ্ড), তাওযীহুল কুরআন (৩ খণ্ড) ও মুসনাদে আহমদ (২ খণ্ড) — মোট ১০টি সংগ্রহে ১০২ খণ্ড বই।\n৪. ফতোয়া ও প্রবন্ধ (${SITE_URL}/fatwa.html): মোট ${toBnDigitsStr(totalTexts)}টি প্রামাণ্য লেখা (${toBnDigitsStr(totalFatwas)}টি ফতোয়া, ${toBnDigitsStr(totalArticles)}টি প্রবন্ধ ও ${toBnDigitsStr(totalQuestions)}টি সংশয় নিরসন প্রশ্নোত্তর)।\n৫. ৮টি বিষয়ভিত্তিক দাওয়াহ হাব (${SITE_URL}/topics.html): আল্লাহর অস্তিত্ব, তাকদীর ও প্রবলেম অব ইভল, কুরআন, হাদীস, রাসূল (ﷺ), ইসলাম ও বিজ্ঞান, নারী ও পরিবার এবং শরীআহ।\n৬. ভিডিও সংকলন (${SITE_URL}/videos.html): ${toBnDigitsStr(totalVideos)}টিরও বেশি নির্বাচিত ইসলামিক লেকচার ও প্রশ্নোত্তর ভিডিও।`;
        return {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'DAWAH X ওয়েবসাইটের সম্পূর্ণ বিভাগসমূহ ও নতুন সংযোজন',
          primary_source: 'dx_site',
          primary_source_code: 'dx_site',
          primary_source_name: 'DAWAH X অফিসিয়াল গাইড',
          primary_doc_type: 'article',
          direct_answer: 'আলহামদুলিল্লাহ! **DAWAH X** ওয়েবসাইটে নতুন সংযোজনসহ বর্তমানে **৬টি প্রধান জ্ঞানভান্ডার** সবার জন্য সম্পূর্ণ বিনামূল্যে ও বিজ্ঞাপনমুক্তভাবে উন্মুক্ত রয়েছে:',
          explanation_paragraphs: [
            `১. **আল-কুরআন (\`quran.html\`):** ১১৪টি সূরার ৬,২৩৬টি আয়াতের আরবি পাঠ, ড. আবু বকর মুহাম্মাদ যাকারিয়ার বাংলা অনুবাদ ও বিস্তারিত তাফসীর।\n২. **আল-হাদীস (\`hadith.html\`):** বুখারী, মুসলিম, তিরমিযী, আবু দাউদ, নাসাঈ, ইবনে মাজাহ, মিশকাত ও রিয়াদুস সালেহীনসহ **২৮টি গ্রন্থে ৬১,৯১০টি হাদীস**।\n৩. **ইসলামিক বই (\`islamic-books.html\`):** তাফসীরে ইবনে কাসীর, আল-বিদায়া ওয়ান নিহায়া, মাআরেফুল কুরআন, তাবারী ও জালালাইনসহ **১০টি সংগ্রহে ১০২ খণ্ড বই**।`,
            `৪. **ফতোয়া ও প্রবন্ধ (\`fatwa.html\`):** নির্ভরযোগ্য উৎস থেকে সংকলিত **${toBnDigitsStr(totalTexts)}টি** ফতোয়া, প্রবন্ধ ও সংশয় নিরসনমূলক প্রশ্নোত্তর।\n৫. **বিষয়ভিত্তিক দাওয়াহ হাব (\`topics.html\`):** আল্লাহর অস্তিত্ব, তাকদীর, বিজ্ঞান, নারী ও শরীআহসহ ৮টি বিশেষ টপিক হাব।\n৬. **ইসলামিক ভিডিও (\`videos.html\`):** **${toBnDigitsStr(totalVideos)}টিরও বেশি** প্রামাণ্য ভিডিও আলোচনা।`,
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_home_overview',
              title: 'DAWAH X — কুরআন, হাদীস, ইসলামিক বই, ফতোয়া ও দাওয়াহ প্ল্যাটফর্ম',
              clean_title: 'DAWAH X — কুরআন, হাদীস, ইসলামিক বই, ফতোয়া ও দাওয়াহ প্ল্যাটফর্ম',
              source_code: 'dx_site',
              source_name: 'DAWAH X মূল সাইট',
              category: 'সারসংক্ষেপ',
              doc_type: 'article',
              dawahx_url: `${SITE_URL}/services.html`,
              share_url: `${SITE_URL}/`,
              confidence: 1.0,
              excerpt: 'কুরআন ও তাফসীর, ২৮ গ্রন্থে ৬১,৯১০ হাদীস, ১০২ খণ্ড ইসলামিক বই, ২৪,২০৭+ ফতোয়া-প্রবন্ধ ও ৯,৩৩৩+ ভিডিও।',
              full_text: overviewBody,
            },
            {
              rank: 2,
              key: 'dx_books_overview',
              title: 'ইসলামিক বই ও তাফসীর গ্রন্থাগার (১০২ খণ্ড) — DAWAH X',
              clean_title: 'ইসলামিক বই ও তাফসীর গ্রন্থাগার (১০২ খণ্ড) — DAWAH X',
              source_code: 'dx_books',
              source_name: 'DAWAH X ইসলামিক বই',
              category: 'বই ও তাফসীর',
              doc_type: 'book',
              dawahx_url: `${SITE_URL}/islamic-books.html`,
              share_url: `${SITE_URL}/islamic-books.html`,
              confidence: 0.99,
              excerpt: '১০টি সংগ্রহে ১০২ খণ্ড তাফসীর, ইতিহাস ও হাদীস গ্রন্থ।',
              full_text: overviewBody,
            },
          ],
          videos: [],
          follow_ups: [
            'DAWAH X এ কী কী ইসলামিক বই ও তাফসীর আছে?',
            'DAWAH X এ কয়টি হাদীস গ্রন্থ রয়েছে?',
            'DAWAH X এ কীভাবে যোগাযোগ করা যাবে?',
          ],
          rag_context: [{ citation: `[1] DAWAH X সেবাসমূহ ও বিভাগ — ${SITE_URL}/services.html`, content: overviewBody }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }
    }

    return null;
  }

  // =========================================================================
  // v22.0 Module B: Verbatim DAWAH X 114-Surah Quran, Tafsir & Metadata Engine
  // =========================================================================
  const SURAH_114_TABLE = [[1,"আল-ফাতিহা","الفاتحة","Al-Fatihah",7,1,5],[2,"আল-বাকারা","البقرة","Al-Baqarah",286,0,87],[3,"আলে ইমরান","آل عمران","Ali 'Imran",200,0,89],[4,"আন-নিসা","النساء","An-Nisa",176,0,92],[5,"আল-মায়িদা","المائدة","Al-Ma'idah",120,0,112],[6,"আল-আন'আম","الأنعام","Al-An'am",165,1,55],[7,"আল-আ'রাফ","الأعراف","Al-A'raf",206,1,39],[8,"আল-আনফাল","الأنفال","Al-Anfal",75,0,88],[9,"আত-তাওবা","التوبة","At-Tawbah",129,0,113],[10,"ইউনুস","يونس","Yunus",109,1,51],[11,"হুদ","هود","Hud",123,1,52],[12,"ইউসুফ","يوسف","Yusuf",111,1,53],[13,"আর-রা'দ","الرعد","Ar-Ra'd",43,0,96],[14,"ইবরাহিম","إبراهيم","Ibrahim",52,1,72],[15,"আল-হিজর","الحجر","Al-Hijr",99,1,54],[16,"আন-নাহল","النحل","An-Nahl",128,1,70],[17,"আল-ইসরা","الإسراء","Al-Isra",111,1,50],[18,"আল-কাহফ","الكهف","Al-Kahf",110,1,69],[19,"মারিয়াম","مريم","Maryam",98,1,44],[20,"তা-হা","طه","Ta-Ha",135,1,45],[21,"আল-আম্বিয়া","الأنبياء","Al-Anbiya",112,1,73],[22,"আল-হাজ্জ","الحج","Al-Hajj",78,0,103],[23,"আল-মু'মিনুন","المؤمنون","Al-Mu'minun",118,1,74],[24,"আন-নূর","النور","An-Nur",64,0,102],[25,"আল-ফুরকান","الفرقان","Al-Furqan",77,1,42],[26,"আশ-শু'আরা","الشعراء","Ash-Shu'ara",227,1,47],[27,"আন-নামল","النمل","An-Naml",93,1,48],[28,"আল-কাসাস","القصص","Al-Qasas",88,1,49],[29,"আল-আনকাবুত","العنكبوت","Al-'Ankabut",69,1,85],[30,"আর-রুম","الروم","Ar-Rum",60,1,84],[31,"লুকমান","لقمان","Luqman",34,1,57],[32,"আস-সাজদা","السجدة","As-Sajdah",30,1,75],[33,"আল-আহযাব","الأحزاب","Al-Ahzab",73,0,90],[34,"সাবা","سبأ","Saba",54,1,58],[35,"ফাতির","فاطر","Fatir",45,1,43],[36,"ইয়াসিন","يس","Ya-Sin",83,1,41],[37,"আস-সাফফাত","الصافات","As-Saffat",182,1,56],[38,"সাদ","ص","Sad",88,1,38],[39,"আয-যুমার","الزمر","Az-Zumar",75,1,59],[40,"গাফির","غافر","Ghafir",85,1,60],[41,"ফুসসিলাত","فصلت","Fussilat",54,1,61],[42,"আশ-শুরা","الشورى","Ash-Shura",53,1,62],[43,"আয-যুখরুফ","الزخرف","Al-Zukhruf",89,1,63],[44,"আদ-দুখান","الدخان","Ad-Dukhan",59,1,64],[45,"আল-জাসিয়া","الجاثية","Al-Jathiyah",37,1,65],[46,"আল-আহকাফ","الأحقاف","Al-Ahqaf",35,1,66],[47,"মুহাম্মাদ","محمد","Muhammad",38,0,95],[48,"আল-ফাতহ","الفتح","Al-Fath",29,0,111],[49,"আল-হুজরাত","الحجرات","Al-Hujurat",18,0,106],[50,"কাফ","ق","Qaf",45,1,34],[51,"আয-যারিয়াত","الذاريات","Adh-Dhariyat",60,1,67],[52,"আত-তুর","الطور","At-Tur",49,1,76],[53,"আন-নাজম","النجم","An-Najm",62,1,23],[54,"আল-কামার","القمر","Al-Qamar",55,1,37],[55,"আর-রহমান","الرحمن","Ar-Rahman",78,0,97],[56,"আল-ওয়াকি'আ","الواقعة","Al-Waqi'ah",96,1,46],[57,"আল-হাদীদ","الحديد","Al-Hadid",29,0,94],[58,"আল-মুজাদালা","المجادلة","Al-Mujadilah",22,0,105],[59,"আল-হাশর","الحشر","Al-Hashr",24,0,101],[60,"আল-মুমতাহিনা","الممتحنة","Al-Mumtahanah",13,0,91],[61,"আস-সাফ","الصف","As-Saff",14,0,109],[62,"আল-জুমু'আ","الجمعة","Al-Jumu'ah",11,0,110],[63,"আল-মুনাফিকুন","المنافقون","Al-Munafiqun",11,0,104],[64,"আত-তাগাবুন","التغابن","At-Taghabun",18,0,108],[65,"আত-তালাক","الطلاق","At-Talaq",12,0,99],[66,"আত-তাহরীম","التحريم","At-Tahrim",12,0,107],[67,"আল-মুলক","الملك","Al-Mulk",30,1,77],[68,"আল-কালাম","القلم","Al-Qalam",52,1,2],[69,"আল-হাক্কা","الحاقة","Al-Haqqah",52,1,78],[70,"আল-মা'আরিজ","المعارج","Al-Ma'arij",44,1,79],[71,"নূহ","نوح","Nuh",28,1,71],[72,"আল-জিন","الجن","Al-Jinn",28,1,40],[73,"আল-মুযযাম্মিল","المزمل","Al-Muzzammil",20,1,3],[74,"আল-মুদ্দাসসির","المدثر","Al-Muddaththir",56,1,4],[75,"আল-কিয়ামা","القيامة","Al-Qiyamah",40,1,31],[76,"আল-ইনসান","الإنسان","Al-Insan",31,0,98],[77,"আল-মুরসালাত","المرسلات","Al-Mursalat",50,1,33],[78,"আন-নাবা","النبأ","An-Naba",40,1,80],[79,"আন-নাযি'আত","النازعات","An-Nazi'at",46,1,81],[80,"'আবাসা","عبس","'Abasa",42,1,24],[81,"আত-তাকভীর","التكوير","At-Takwir",29,1,7],[82,"আল-ইনফিতার","الانفطار","Al-Infitar",19,1,82],[83,"আল-মুতাফফিফিন","المطففين","Al-Mutaffifin",36,1,86],[84,"আল-ইনশিকাক","الانشقاق","Al-Inshiqaq",25,1,83],[85,"আল-বুরুজ","البروج","Al-Buruj",22,1,27],[86,"আত-তারিক","الطارق","At-Tariq",17,1,36],[87,"আল-আ'লা","الأعلى","Al-A'la",19,1,8],[88,"আল-গাশিয়া","الغاشية","Al-Ghashiyah",26,1,68],[89,"আল-ফাজর","الفجر","Al-Fajr",30,1,10],[90,"আল-বালাদ","البلد","Al-Balad",20,1,35],[91,"আশ-শামস","الشمس","Ash-Shams",15,1,26],[92,"আল-লাইল","الليل","Al-Layl",21,1,9],[93,"আদ-দুহা","الضحى","Ad-Duha",11,1,11],[94,"আশ-শারহ","الشرح","Ash-Sharh",8,1,12],[95,"আত-তীন","التين","At-Tin",8,1,28],[96,"আল-'আলাক","العلق","Al-'Alaq",19,1,1],[97,"আল-কাদর","القدر","Al-Qadr",5,1,25],[98,"আল-বাইয়িনা","البينة","Al-Bayyinah",8,0,100],[99,"আয-যিলযাল","الزلزلة","Az-Zalzalah",8,0,93],[100,"আল-'আদিয়াত","العاديات","Al-'Adiyat",11,1,14],[101,"আল-কারি'আ","القارعة","Al-Qari'ah",11,1,30],[102,"আত-তাকাসুর","التكاثر","At-Takathur",8,1,16],[103,"আল-'আসর","العصر","Al-'Asr",3,1,13],[104,"আল-হুমাযা","الهمزة","Al-Humazah",9,1,32],[105,"আল-ফীল","الفيل","Al-Fil",5,1,19],[106,"কুরাইশ","قريش","Quraysh",4,1,29],[107,"আল-মা'উন","الماعون","Al-Ma'un",7,1,17],[108,"আল-কাওসার","الكوثر","Al-Kawthar",3,1,15],[109,"আল-কাফিরুন","الكافرون","Al-Kafirun",6,1,18],[110,"আন-নাসর","النصر","An-Nasr",3,0,114],[111,"আল-মাসাদ","المسد","Al-Masad",5,1,6],[112,"আল-ইখলাস","الإخلاص","Al-Ikhlas",4,1,22],[113,"আল-ফালাক","الفلق","Al-Falaq",5,1,20],[114,"আন-নাস","الناس","An-Nas",6,1,21]];

  const EXTRA_SURAH_ALIASES = [
    [1, ['ফাতিহা', 'ফাতেহা', 'fatiha', 'fatihah']],
    [2, ['বাকারা', 'বাকারাহ', 'বাক্বারাহ', 'baqara', 'baqarah', 'bakara']],
    [3, ['আলে ইমরান', 'আল ইমরান', 'ইমরান', 'imran']],
    [4, ['নিসা', 'আন নিসা', 'nisa']],
    [5, ['মায়িদা', 'মায়েদা', 'মায়েদাহ', 'maidah']],
    [6, ['আনআম', 'আন-আম', 'anam']],
    [7, ['আরাফ', 'আ-রাফ', 'araf']],
    [8, ['আনফাল', 'anfal']],
    [9, ['তাওবা', 'তওবা', 'তাওবাহ', 'বারাআত', 'tawbah', 'tauba']],
    [12, ['ইউসুফ', 'yusuf']],
    [13, ['রাদ', 'রা-দ', 'rad']],
    [16, ['নাহল', 'nahl']],
    [17, ['বনী ইসরাঈল', 'বনি ইসরাইল', 'ইসরা', 'isra']],
    [18, ['কাহফ', 'কাহাফ', 'kahf', 'kahaf']],
    [19, ['মারইয়াম', 'মরিয়ম', 'মারিয়াম', 'maryam']],
    [20, ['ত্বা-হা', 'তাহা', 'taha']],
    [23, ['মুমিনুন', 'মুমিনূন', 'মু’মিনূন', 'muminun']],
    [24, ['নূর', 'নুর', 'nur']],
    [31, ['লুকমান', 'লোকমান', 'luqman']],
    [32, ['সাজদা', 'সাজদাহ', 'সিজদা', 'sajdah']],
    [33, ['আহযাব', 'আহজাব', 'ahzab']],
    [36, ['ইয়াসীন', 'ইয়াসিন', 'ইয়াসীন', 'yasin', 'yaseen']],
    [40, ['মুমিন', 'গাফির', 'ghafir']],
    [41, ['হা-মীম সিজদা', 'ফুসসিলাত', 'fussilat']],
    [47, ['মুহাম্মাদ', 'মুহাম্মদ', 'muhammad']],
    [48, ['ফাতহ', 'ফাতাহ', 'fath']],
    [49, ['হুজুরাত', 'হুজরাত', 'hujurat']],
    [55, ['আর রহমান', 'রহমান', 'রাহমান', 'rahman']],
    [56, ['ওয়াকিয়া', 'ওয়াকিয়াহ', 'ওয়াক্বিয়াহ', 'waqiah']],
    [59, ['হাশর', 'hashr']],
    [62, ['জুমুআ', 'জুমুআহ', 'জুমা', 'jumuah']],
    [67, ['মুলক', 'তাবারাকাল্লাযী', 'mulk']],
    [72, ['জিন', 'জ্বীন', 'jinn']],
    [73, ['মুযযাম্মিল', 'মুজ্জাম্মিল', 'muzzammil']],
    [74, ['মুদ্দাসসির', 'মুদ্দাচ্ছির', 'muddassir']],
    [76, ['দাহর', 'ইনসান', 'insan', 'dahr']],
    [78, ['নাবা', 'আম্মা', 'naba']],
    [87, ['আলা', 'আ’লা', 'ala']],
    [93, ['দুহা', 'যুহা', 'duha']],
    [94, ['ইনশিরাহ', 'আলাম নাশরাহ', 'শারহ', 'inshirah', 'sharh']],
    [95, ['তীন', 'তিন', 'tin']],
    [96, ['আলাক', 'ইকরা', 'alaq']],
    [97, ['কদর', 'ক্বদর', 'কাদর', 'qadr', 'kodor']],
    [98, ['বাইয়্যিনাহ', 'বাইয়িনা', 'bayyinah']],
    [99, ['যিলযাল', 'যিলযিলাহ', 'জিলজাল', 'zilzal', 'zalzalah']],
    [102, ['তাকাসুর', 'তাকাছুর', 'takathur']],
    [103, ['আসর', 'আছর', 'asr']],
    [105, ['ফীল', 'ফিল', 'fil']],
    [106, ['কুরাইশ', 'কোরাইশ', 'quraish']],
    [107, ['মাউন', 'মাঊন', 'maun']],
    [108, ['কাওসার', 'কাউসার', 'কাউছার', 'kawthar', 'kausar']],
    [109, ['কাফিরুন', 'কাফিরূন', 'kafirun']],
    [110, ['নাসর', 'নাছর', 'nasr']],
    [111, ['লাহাব', 'মাসাদ', 'lahab', 'masad']],
    [112, ['ইখলাস', 'ইখলাছ', 'কুল হুওয়াল্লাহু', 'ikhlas']],
    [113, ['ফালাক', 'ফালাক্ব', 'falaq']],
    [114, ['নাস', 'নাছ', 'nas']],
  ];

  function normalizeSurahAlias(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFC')
      .replace(/['’‘`\-_]/g, ' ')
      .replace(/^(?:আল|আন|আর|আস|আশ|আত|আদ|আয)\s+/u, '')
      .replace(/য়/g, 'য়')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findSurahAfterKeyword(text) {
    const qNorm = String(text || '')
      .toLowerCase()
      .normalize('NFC')
      .replace(/য়/g, 'য়')
      .replace(/['’‘`]/g, '');

    // Check explicit numeric surah first: "সূরা ৩৬" or "৩৬ নং সূরা"
    const mNumAfter = qNorm.match(/(?:সূরা|সুরা|surah|sura)\s*([০-৯0-9]{1,3})(?!\s*[:：])/iu);
    if (mNumAfter) {
      const sn = parseBnOrAsciiInt(mNumAfter[1]);
      if (sn >= 1 && sn <= 114) return SURAH_114_TABLE[sn - 1];
    }
    const mNumBefore = qNorm.match(/([০-৯0-9]{1,3})\s*(?:নং|নম্বর|তম)\s*(?:সূরা|সুরা|surah)/iu);
    if (mNumBefore) {
      const sn = parseBnOrAsciiInt(mNumBefore[1]);
      if (sn >= 1 && sn <= 114) return SURAH_114_TABLE[sn - 1];
    }

    // Match surah name right after সূরা/সুরা/surah
    const candidates = [];
    for (const row of SURAH_114_TABLE) {
      const bare = normalizeSurahAlias(row[1]);
      const full = row[1].toLowerCase().normalize('NFC').replace(/য়/g, 'য়').replace(/['’‘`\-]/g, ' ').trim();
      const en = row[3].toLowerCase().replace(/['\-]/g, ' ').trim();
      const enBare = en.replace(/^(?:al|an|ar|as|ash|at|ad|az)\s+/, '');
      for (const al of [full, bare, en, enBare]) {
        if (al.length >= 2) candidates.push([al, row]);
      }
    }
    for (const [sn, list] of EXTRA_SURAH_ALIASES) {
      const row = SURAH_114_TABLE[sn - 1];
      for (const al of list) {
        const cleanAl = al.toLowerCase().normalize('NFC').replace(/য়/g, 'য়').trim();
        if (cleanAl.length >= 2) candidates.push([cleanAl, row]);
      }
    }
    // Sort longest alias first so "আলে ইমরান" beats "ইমরান" and "ফালাক" never collides with shorter prefixes
    candidates.sort((a, b) => b[0].length - a[0].length);

    for (const [alias, row] of candidates) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\-]*');
      const re = new RegExp(`(?:সূরা|সুরা|surah|sura)\\s+(?:আল[\\s\\-]*|আন[\\s\\-]*|আর[\\s\\-]*|আস[\\s\\-]*|আশ[\\s\\-]*|আত[\\s\\-]*)?${escaped}(?:র|ের|য়|য়|তে|ে)?(?=[\\s,।?!:;০-৯0-9]|$)`, 'iu');
      if (re.test(qNorm)) return row;
    }
    return null;
  }

  async function getQuranArabicData() {
    const key = 'parsed:scripture-quran-data';
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = fetchWithFallback('scripture-quran-data.js', true)
      .then((txt) => parseWindowScriptJson(txt, 'QURAN'))
      .catch(() => null);
    cacheMap.set(key, p);
    return p;
  }

  async function getSurahBnTranslation(suraNum) {
    const key = `parsed:scripture-bn-${suraNum}`;
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = fetchWithFallback(`scripture-bn-${suraNum}.js`, true)
      .then((txt) => parseWindowScriptJson(txt, 'BN_SURAHS'))
      .catch(() => null);
    cacheMap.set(key, p);
    return p;
  }

  async function getSurahBnTafsir(suraNum) {
    const key = `parsed:scripture-tafsir-${suraNum}`;
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = fetchWithFallback(`scripture-tafsir-${suraNum}.js`, true)
      .then((txt) => parseWindowScriptJson(txt, 'BN_TAFSIR'))
      .catch(() => null);
    cacheMap.set(key, p);
    return p;
  }

  function buildAlafasyMp3Url(suraNum, ayahNum) {
    return `https://verses.quran.foundation/Alafasy/mp3/${String(suraNum).padStart(3, '0')}${String(ayahNum).padStart(3, '0')}.mp3`;
  }

  async function resolveDawahXQuranScripture(question, t0) {
    const q = String(question || '').trim();

    // 1. Total Surahs / Ayahs / Sajdas in Quran metadata query
    if (
      /(?:কুরআনে|কোরআনে)\s*(?:মোট\s*)?(?:কয়টি|কতটি|কতগুলো)\s*(?:সূরা|সুরা|আয়াত|পারা|সিজদা)/iu.test(q) ||
      /(?:সূরা|সুরা)\s*ও\s*আয়াত\s*(?:সংখ্যা\s*)?(?:কত|কয়টি)/iu.test(q)
    ) {
      const quranUrl = `${SITE_URL}/quran.html`;
      const metaText = 'পবিত্র আল-কুরআনে মোট ১১৪টি সূরা, ৬,২৩৬টি আয়াত (বিসমিল্লাহ ব্যতীত কুফী গণনা অনুযায়ী), ৩০টি পারা (জুয) এবং তিলাওয়াতের সিজদার আয়াত রয়েছে ১৫টি (মতান্তরে ১৪টি)। ১১৪টি সূরার মধ্যে প্রসিদ্ধ গণনা অনুযায়ী ৮৬টি মাক্কী এবং ২৮টি মাদানী সূরা।';
      return {
        mode: 'direct',
        payload: {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: 'পবিত্র আল-কুরআনের সূরা, আয়াত, পারা ও সিজদার সংখ্যা',
          primary_source: 'dx_quran',
          primary_source_code: 'dx_quran',
          primary_source_name: 'DAWAH X আল-কুরআন',
          primary_doc_type: 'quran',
          direct_answer: 'পবিত্র **আল-কুরআনে** মোট **১১৪টি সূরা**, **৬,২৩৬টি আয়াত** (প্রসিদ্ধ কুফী গণনা অনুযায়ী), **৩০টি পারা (জুয)** এবং তিলাওয়াতের সিজদার আয়াত রয়েছে **১৫টি** (মতান্তরে ১৪টি)।',
          explanation_paragraphs: [
            'অবতরণের স্থান ও সময়কাল অনুসারে ১১৪টি সূরার মধ্যে **৮৬টি মাক্কী সূরা** (হিজরতের পূর্বে অবতীর্ণ) এবং **২৮টি মাদানী সূরা** (হিজরতের পরে অবতীর্ণ)। সবচেয়ে ছোট সূরা হলো **সূরা আল-কাওসার** (৩ আয়াত) এবং সবচেয়ে বড় সূরা হলো **সূরা আল-বাকারা** (২৮৬ আয়াত)।',
            'আপনি **DAWAH X আল-কুরআন (`quran.html`)** পাতায় ১১৪টি সূরার প্রতিটি আয়াত আরবি পাঠ, ড. আবু বকর মুহাম্মাদ যাকারিয়ার বাংলা অনুবাদ ও বিস্তারিত তাফসীরসহ পড়তে পারবেন।',
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: 'dx_quran_meta',
              title: 'আল-কুরআনুল কারীম (১১৪ সূরা · ৬,২৩৬ আয়াত) — DAWAH X',
              clean_title: 'আল-কুরআনুল কারীম (১১৪ সূরা · ৬,২৩৬ আয়াত) — DAWAH X',
              source_code: 'dx_quran',
              source_name: 'DAWAH X আল-কুরআন',
              category: 'কুরআন পরিচিতি',
              doc_type: 'quran',
              dawahx_url: quranUrl,
              share_url: quranUrl,
              confidence: 1.0,
              excerpt: metaText,
              full_text: metaText,
            },
          ],
          videos: [],
          follow_ups: [
            'সূরা ফাতিহার আরবি, বাংলা অর্থ ও তাফসীর বলো',
            'আয়াতুল কুরসী আরবি ও বাংলা অর্থসহ বলো',
            'সূরা বাকারার শেষ দুই আয়াত অর্থসহ দাও',
          ],
          rag_context: [{ citation: `[1] আল-কুরআন — DAWAH X (${quranUrl})`, content: metaText }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        },
      };
    }

    // 2. Specific Surah Metadata query (e.g., "কুরআনের ৩৬ নং সূরা কোনটি?", "সূরা বাকারায় কয়টি আয়াত আছে?", "সূরা ইখলাস মাক্কী নাকি মাদানী?")
    const surahRowFromQuery = findSurahAfterKeyword(q);
    const asksSurahIdentityOrCount =
      /(?:[০-৯0-9]{1,3}\s*(?:নং|নম্বর|তম)\s*(?:সূরা|সুরা)\s*(?:কোনটি|কী|কি|এর\s*নাম))|(?:(?:সূরা|সুরা).*(?:কয়টি|কতটি|কত)\s*আয়াত)|(?:(?:সূরা|সুরা).*(?:মাক্ক[ীি]|মাদান[ীি]))|(?:(?:সূরা|সুরা).*(?:কত\s*নম্বর|কত\s*নং\s*সূরা))/iu.test(q);

    if (surahRowFromQuery && asksSurahIdentityOrCount) {
      const [sNum, sBn, sAr, sEn, sCount, isMakki, revOrder] = surahRowFromQuery;
      const revType = isMakki ? 'মাক্কী' : 'মাদানী';
      const sUrl = `${SITE_URL}/quran.html#/s/${sNum}`;
      const quranComUrl = `https://quran.com/${sNum}`;
      const bnArr = await getSurahBnTranslation(sNum);
      const firstVerseBn = Array.isArray(bnArr) && bnArr[0] ? bnArr[0].replace(/\s*\[[০-৯0-9]+\]/g, '') : '';
      const fullInfo = `সূরা ক্রমিক নং: ${toBnDigitsStr(sNum)}\nনাম: সূরা ${sBn} (${sAr} · ${sEn})\nমোট আয়াত সংখ্যা: ${toBnDigitsStr(sCount)}টি\nঅবতরণকাল: ${revType} সূরা (নাযিলের ক্রম: ${toBnDigitsStr(revOrder)})\n${firstVerseBn ? `\nপ্রথম আয়াতের অনুবাদ: "${firstVerseBn}"` : ''}`;

      return {
        mode: 'direct',
        payload: {
          status: 'answered',
          is_chat: false,
          is_verbatim_card: true,
          query: question,
          headline: `সূরা ${sBn} (${sAr}) — কুরআনের ${toBnDigitsStr(sNum)} নং সূরা`,
          primary_source: 'dx_quran',
          primary_source_code: 'dx_quran',
          primary_source_name: 'DAWAH X আল-কুরআন',
          primary_doc_type: 'quran',
          direct_answer: `পবিত্র কুরআনের **${toBnDigitsStr(sNum)} নম্বর সূরা** হলো **সূরা ${sBn} (${sAr} / ${sEn})**। এটি একটি **${revType}** সূরা এবং এতে মোট **${toBnDigitsStr(sCount)}টি আয়াত** রয়েছে *(নাযিলের ক্রম: ${toBnDigitsStr(revOrder)})*।`,
          explanation_paragraphs: [
            firstVerseBn ? `এই সূরার প্রথম আয়াতের অর্থ (ড. আবু বকর মুহাম্মাদ যাকারিয়া): *"${firstVerseBn}"*` : '',
            `সূরা ${sBn}-এর সম্পূর্ণ আরবি পাঠ, বাংলা অনুবাদ ও বিস্তারিত তাফসীর নিচে **DAWAH X আল-কুরআন** এবং **Quran.com** লিংক থেকে সরাসরি পড়তে ও তিলাওয়াত শুনতে পারবেন।`,
          ].filter(Boolean),
          additional_perspectives: [],
          evidences: [],
          sources: [
            {
              rank: 1,
              key: `dx_surah_${sNum}`,
              title: `সূরা ${sBn} (${sAr}) — মোট ${toBnDigitsStr(sCount)} আয়াত`,
              clean_title: `সূরা ${sBn} (${sAr}) — মোট ${toBnDigitsStr(sCount)} আয়াত`,
              source_code: 'dx_quran',
              source_name: 'DAWAH X আল-কুরআন ও তাফসীর',
              category: `${revType} সূরা · ক্রম ${toBnDigitsStr(sNum)}`,
              doc_type: 'quran',
              dawahx_url: sUrl,
              share_url: sUrl,
              confidence: 1.0,
              excerpt: fullInfo,
              full_text: fullInfo,
              audio_url: buildAlafasyMp3Url(sNum, 1),
            },
          ],
          external_sources: [
            {
              provider: 'quran_com',
              provider_name: 'Quran.com',
              badge: 'আল-কুরআন · Quran.com',
              ref: `${sNum}:1-${sCount}`,
              title: `সূরা ${sBn} (${sAr}) — Quran.com`,
              arabic: sAr,
              translation_bn: `মোট ${toBnDigitsStr(sCount)}টি আয়াত · ${revType} সূরা`,
              translator: 'ড. আবু বকর মুহাম্মাদ যাকারিয়া',
              audio_url: buildAlafasyMp3Url(sNum, 1),
              url: quranComUrl,
              full_text: fullInfo,
            },
          ],
          videos: [],
          follow_ups: [
            `সূরা ${sBn}-এর প্রথম আয়াতগুলোর অর্থ ও তাফসীর বলো`,
            'আয়াতুল কুরসী আরবি ও বাংলা অর্থসহ বলো',
            'কুরআনে মোট কয়টি সূরা ও আয়াত আছে?',
          ],
          rag_context: [{ citation: `[1] সূরা ${sBn} (${sUrl})`, content: fullInfo }],
          confidence: 1.0,
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          ask_team_url: `${SITE_URL}/ask.html`,
        },
      };
    }

    // 3. Detect Named Verses, Ranges, Short Surahs, or Explicit Surah:Ayah(-End)
    let targetSpec = null; // { sura, start, end, label }

    if (/(?:আ(?:য়|য়)াতুল\s*কুরস[ীি]|ayatul\s*kursi)/iu.test(q)) {
      targetSpec = { sura: 2, start: 255, end: 255, label: 'আয়াতুল কুরসী (সূরা আল-বাকারা ২:২৫৫)' };
    } else if (/(?:বাকারা|বাকারাহ|baqarah?).*(?:শেষ\s*(?:দুই|দুইটি|২\s*(?:টি)?|দু’টি)\s*আ(?:য়|য়)াত)/iu.test(q)) {
      targetSpec = { sura: 2, start: 285, end: 286, label: 'সূরা আল-বাকারার শেষ দুই আয়াত (২:২৮৫-২৮৬)' };
    } else if (/(?:কাহফ|কাহাফ|kahf).*(?:প্রথম\s*(?:দশ|(?:১০|10)\s*(?:টি)?)\s*আ(?:য়|য়)াত)/iu.test(q)) {
      targetSpec = { sura: 18, start: 1, end: 10, label: 'সূরা আল-কাহফের প্রথম ১০ আয়াত (১৮:১-১০)' };
    } else if (/(?:কাহফ|কাহাফ|kahf).*(?:শেষ\s*(?:দশ|(?:১০|10)\s*(?:টি)?)\s*আ(?:য়|য়)াত)/iu.test(q)) {
      targetSpec = { sura: 18, start: 101, end: 110, label: 'সূরা আল-কাহফের শেষ ১০ আয়াত (১৮:১০১-১১০)' };
    } else if (/(?:হাশর|hashr).*(?:শেষ\s*(?:তিন|তিনটি|৩\s*(?:টি)?)\s*আ(?:য়|য়)াত)/iu.test(q)) {
      targetSpec = { sura: 59, start: 22, end: 24, label: 'সূরা আল-হাশরের শেষ তিন আয়াত (৫৯:২২-২৪)' };
    } else if (surahRowFromQuery && /(?:প্রথম|শেষ)\s*([০-৯0-9]{1,2})\s*(?:টি\s*)?আ(?:য়|য়)াত/iu.test(q)) {
      const mFL = q.match(/(প্রথম|শেষ)\s*([০-৯0-9]{1,2})\s*(?:টি\s*)?আ(?:য়|য়)াত/iu);
      const cnt = Math.min(15, Math.max(1, parseBnOrAsciiInt(mFL[2])));
      const [sNum, sBn, , , maxA] = surahRowFromQuery;
      const startA = mFL[1] === 'প্রথম' ? 1 : Math.max(1, maxA - cnt + 1);
      const endA = mFL[1] === 'প্রথম' ? Math.min(maxA, cnt) : maxA;
      targetSpec = {
        sura: sNum,
        start: startA,
        end: endA,
        label: `সূরা ${sBn}-এর ${mFL[1]} ${toBnDigitsStr(endA - startA + 1)} আয়াত (${toBnDigitsStr(sNum)}:${toBnDigitsStr(startA)}-${toBnDigitsStr(endA)})`,
      };
    } else {
      // Colon notation: 2:255 or 2:285-286
      const mColon = q.match(/(?:^|[^\d০-৯])([০-৯0-9]{1,3})\s*[:：]\s*([০-৯0-9]{1,3})(?:\s*[-–— থেকে]+\s*([০-৯0-9]{1,3}))?(?![\d০-৯])/u);
      if (mColon) {
        const s = parseBnOrAsciiInt(mColon[1]);
        const a1 = parseBnOrAsciiInt(mColon[2]);
        const a2 = mColon[3] ? parseBnOrAsciiInt(mColon[3]) : a1;
        if (s >= 1 && s <= 114) {
          const maxA = SURAH_114_TABLE[s - 1][4];
          if (a1 >= 1 && a1 <= maxA) {
            const endA = Math.min(maxA, Math.max(a1, Math.min(a2, a1 + 14)));
            targetSpec = { sura: s, start: a1, end: endA };
          }
        }
      }

      // Named surah + ayah / range: "সূরা বাকারার ২৫৫ নং আয়াত" or "সূরা মুমিনুনের ১-৫ আয়াত" or "সূরা আহযাবের ৩২ ও ৩৩ নং আয়াত"
      if (!targetSpec && surahRowFromQuery) {
        const [sNum, sBn, , , maxA] = surahRowFromQuery;
        const mRange = q.match(/(?:সূরা|সুরা|surah|sura)\s+\S+(?:\s+\S+)?\s*(?:এর\s*)?([০-৯0-9]{1,3})\s*(?:[-–—]|থেকে|ও|এবং)\s*([০-৯0-9]{1,3})\s*(?:নং|নম্বর|তম)?\s*আয়াত/iu);
        const mSingle = q.match(/(?:সূরা|সুরা|surah|sura)\s+\S+(?:\s+\S+)?\s*(?:এর\s*)?([০-৯0-9]{1,3})\s*(?:নং|নম্বর|তম)?\s*আয়াত/iu) ||
                        q.match(/([০-৯0-9]{1,3})\s*(?:নং|নম্বর|তম)\s*আয়াত/iu);
        if (mRange) {
          const a1 = parseBnOrAsciiInt(mRange[1]);
          const a2 = parseBnOrAsciiInt(mRange[2]);
          if (a1 >= 1 && a1 <= maxA && a2 >= a1) {
            targetSpec = { sura: sNum, start: a1, end: Math.min(maxA, a1 + 14, a2) };
          }
        } else if (mSingle) {
          const a1 = parseBnOrAsciiInt(mSingle[1]);
          if (a1 >= 1 && a1 <= maxA) {
            targetSpec = { sura: sNum, start: a1, end: a1 };
          }
        } else if (
          maxA <= 15 &&
          /(?:অর্থ|অনুবাদ|তাফস[ীি]র|আরবি|বাংলা|বলো|বলুন|দাও|দিন|লিখ|শোনাও|পড়)/iu.test(q) &&
          !/(?:ফযীলত|ফজিলত|কখন\s*পড়|সালাতে|নামাজে|ইমামের|পিছনে|ভুল|অভিযোগ)/iu.test(q)
        ) {
          // Short surah requested in full (e.g., "সূরা ফাতিহার অর্থ ও তাফসীর বলো", "সূরা ইখলাস অর্থসহ")
          targetSpec = { sura: sNum, start: 1, end: maxA, label: `সূরা ${sBn} (সম্পূর্ণ ১–${toBnDigitsStr(maxA)} আয়াত)` };
        }
      }
    }

    if (!targetSpec) return null;

    // Distinguish direct scripture/tafsir request vs apologetic/fiqh ruling question ABOUT that verse!
    // e.g., "সুরা আহযাবের ৩২ ও ৩৩ নং আয়াতে কি ব্যাকরণগত ভুল আছে?" or "আয়াতুল কুরসী ঘুমানোর আগে পড়ার ফযীলত কী?" -> enrich mode!
    const isFiqhOrObjectionAboutVerse =
      /(?:ব্যাকরণগত|ভুল\s*আছে|অভিযোগ|স্ববিরোধ|বৈপরীত্য|দ্বন্দ্ব|নাস্তিক|সংশয়|কি\s*বৈধ|জায়েয\s*কি|হারাম\s*কি|কখন\s*পড়তে\s*হয়|পড়ার\s*পূর্বে\s*কি\s*আউযুবিল্লাহ)/iu.test(q);

    const [sNum, sBn, sAr, sEn, maxA, isMakki] = SURAH_114_TABLE[targetSpec.sura - 1];
    const startA = targetSpec.start;
    const endA = targetSpec.end;

    const [bnArr, tafArr, quranArObj] = await Promise.all([
      getSurahBnTranslation(sNum),
      getSurahBnTafsir(sNum),
      getQuranArabicData(),
    ]);

    if (!Array.isArray(bnArr) || !bnArr.length) return null;

    const arSurah = quranArObj && Array.isArray(quranArObj.verses) ? quranArObj.verses[sNum - 1] : null;
    const verseBlocks = [];
    const tafsirBlocks = [];
    const evidences = [];

    for (let a = startA; a <= endA; a++) {
      const arText = (Array.isArray(arSurah) && arSurah[a - 1]) || '';
      const rawBn = bnArr[a - 1] || '';
      const cleanBn = rawBn.replace(/\s*\[[০-৯0-9]+\]/g, '').replace(/\s+/g, ' ').trim();
      const rawTaf = Array.isArray(tafArr) ? (tafArr[a - 1] || '') : '';
      const cleanTaf = stripHtmlClean(rawTaf);

      verseBlocks.push({
        ayah: a,
        ar: arText,
        bn: cleanBn,
        tafsir: cleanTaf,
      });

      evidences.push({
        text: `${arText ? arText + '\n' : ''}অনুবাদ (${toBnDigitsStr(sNum)}:${toBnDigitsStr(a)}): "${cleanBn}"`,
        source_title: `সূরা ${sBn} (${toBnDigitsStr(sNum)}:${toBnDigitsStr(a)})`,
        source_name: 'DAWAH X আল-কুরআন · ড. আবু বকর মুহাম্মাদ যাকারিয়া',
        dawahx_url: `${SITE_URL}/quran.html#/s/${sNum}/a/${a}`,
      });

      if (cleanTaf) {
        tafsirBlocks.push(`আয়াত ${toBnDigitsStr(a)}-এর তাফসীর:\n${trimCleanly(cleanTaf, endA > startA ? 650 : 1600)}`);
      }
    }

    const rangeRefBn = startA === endA ? `${toBnDigitsStr(sNum)}:${toBnDigitsStr(startA)}` : `${toBnDigitsStr(sNum)}:${toBnDigitsStr(startA)}-${toBnDigitsStr(endA)}`;
    const rangeRefAscii = startA === endA ? `${sNum}:${startA}` : `${sNum}:${startA}-${endA}`;
    const dawahxQuranUrl = `${SITE_URL}/quran.html#/s/${sNum}/a/${startA}`;
    const quranComUrl = `https://quran.com/${sNum}/${rangeRefAscii.split(':')[1]}`;
    const headlineLabel = targetSpec.label || `সূরা ${sBn} (${rangeRefBn}) — আরবি, অনুবাদ ও তাফসীর`;

    const fullReaderText = verseBlocks
      .map(
        (v) =>
          `【সূরা ${sBn} ${toBnDigitsStr(sNum)}:${toBnDigitsStr(v.ayah)}】\n${v.ar ? v.ar + '\n\n' : ''}বাংলা অনুবাদ (ড. আবু বকর মুহাম্মাদ যাকারিয়া):\n${v.bn}${v.tafsir ? '\n\nতাফসীর ও টীকা:\n' + v.tafsir : ''}`
      )
      .join('\n\n────────────────────\n\n');

    const sourceCard = {
      rank: 1,
      key: `dx_q_${sNum}_${startA}_${endA}`,
      title: headlineLabel,
      clean_title: headlineLabel,
      source_code: 'dx_quran',
      source_name: 'DAWAH X আল-কুরআন ও তাফসীর',
      category: `${isMakki ? 'মাক্কী' : 'মাদানী'} সূরা · ড. আবু বকর যাকারিয়া`,
      doc_type: 'quran',
      dawahx_url: dawahxQuranUrl,
      share_url: dawahxQuranUrl,
      confidence: 1.0,
      excerpt: trimCleanly(verseBlocks.map((v) => `(${toBnDigitsStr(v.ayah)}) ${v.bn}`).join(' '), 240),
      full_text: fullReaderText,
      audio_url: buildAlafasyMp3Url(sNum, startA),
    };

    const extCard = {
      provider: 'quran_com',
      provider_name: 'Quran.com',
      badge: 'আল-কুরআন · Quran.com',
      ref: rangeRefAscii,
      title: `সূরা ${sBn} (${rangeRefBn}) — Quran.com`,
      arabic: verseBlocks.slice(0, 3).map((v) => v.ar).filter(Boolean).join(' ۝ '),
      translation_bn: trimCleanly(verseBlocks.map((v) => `(${toBnDigitsStr(v.ayah)}) ${v.bn}`).join(' '), 520),
      translator: 'ড. আবু বকর মুহাম্মাদ যাকারিয়া',
      tafsir_name: tafsirBlocks.length ? 'তাফসীর ড. আবু বকর যাকারিয়া' : '',
      tafsir_snippet: tafsirBlocks.length ? trimCleanly(tafsirBlocks[0], 380) : '',
      audio_url: buildAlafasyMp3Url(sNum, startA),
      url: quranComUrl,
      full_text: fullReaderText,
    };

    const ragEntry = {
      citation: `[কুরআন ও তাফসীর] ${headlineLabel} — DAWAH X (${dawahxQuranUrl}) ও Quran.com (${quranComUrl})`,
      content: fullReaderText.slice(0, 3600),
    };

    if (isFiqhOrObjectionAboutVerse) {
      return {
        mode: 'enrich',
        sourceCard,
        extCard,
        evidences: evidences.slice(0, 3),
        ragEntry,
      };
    }

    const directLines = verseBlocks
      .map(
        (v) =>
          `${v.ar ? `**আয়াত ${toBnDigitsStr(sNum)}:${toBnDigitsStr(v.ayah)}:**\n${v.ar}\n` : ''}**অনুবাদ (${toBnDigitsStr(sNum)}:${toBnDigitsStr(v.ayah)}):** "${v.bn}"`
      )
      .join('\n\n');

    const explParas = [];
    if (tafsirBlocks.length) {
      explParas.push(`**সংক্ষিপ্ত তাফসীর (ড. আবু বকর মুহাম্মাদ যাকারিয়া):**\n${tafsirBlocks.slice(0, 3).join('\n\n')}`);
    }
    explParas.push(
      `সূরা ${sBn} একটি **${isMakki ? 'মাক্কী' : 'মাদানী'}** সূরা (মোট ${toBnDigitsStr(maxA)} আয়াত)। নিচের উৎস কার্ড থেকে সম্পূর্ণ তাফসীর পড়তে এবং শায়খ মিশারি রাশিদ আল-আফাসির তিলাওয়াত শুনতে পারবেন।`
    );

    return {
      mode: 'direct',
      payload: {
        status: 'answered',
        is_chat: false,
        is_verbatim_card: true,
        query: question,
        headline: headlineLabel,
        primary_source: 'dx_quran',
        primary_source_code: 'dx_quran',
        primary_source_name: 'DAWAH X আল-কুরআন ও তাফসীর',
        primary_doc_type: 'quran',
        direct_answer: `আলহামদুলিল্লাহ, **${headlineLabel}** (ড. আবু বকর মুহাম্মাদ যাকারিয়ার অনুবাদ ও তাফসীর অনুযায়ী) নিচে তুলে ধরা হলো:\n\n${directLines}`,
        explanation_paragraphs: explParas,
        additional_perspectives: [],
        evidences: evidences.slice(0, 5),
        sources: [sourceCard],
        external_sources: [extCard],
        videos: [],
        follow_ups: [
          startA < maxA ? `সূরা ${sBn}-এর ${toBnDigitsStr(Math.min(maxA, endA + 1))} নং আয়াতের অর্থ ও তাফসীর বলো` : `সূরা ${sBn}-এ মোট কয়টি আয়াত আছে?`,
          'আয়াতুল কুরসী আরবি ও বাংলা অর্থসহ বলো',
          'সূরা বাকারার শেষ দুই আয়াত অর্থসহ দাও',
        ],
        rag_context: [ragEntry],
        confidence: 1.0,
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        ask_team_url: `${SITE_URL}/ask.html`,
      },
    };
  }

  // =========================================================================
  // v22.0 Module C: Direct 28-Book, 61,910-Hadith Lookup & 32-Shard Hadith Search
  // =========================================================================
  const HADITH_BOOK_PATTERNS = [
    { id: 'rafayadain', hbdSlug: null, re: /(?:রাফা(?:য়|য়)েল\s*ই(?:য়|য়)াদাইন|জুজ.?উল\s*রাফ)/iu },
    { id: 'shamail', hbdSlug: 'shamail-muhammadiyah', re: /(?:শামা(?:য়|য়)েলে?\s*তিরমি[যজ][ীি]|shamail)/iu },
    { id: 'mishkatdaif', hbdSlug: null, re: /(?:মিশকাতে?\s*[যজ](?:ঈ|য়|য়)[ীি]?ফ)/iu },
    { id: 'ramadandaif', hbdSlug: null, re: /(?:রম[যজ]ানের?\s*দুর্বল\s*হাদ[ীি]স)/iu },
    { id: 'daifseries', hbdSlug: null, re: /(?:জাল\s*ও\s*[যজ](?:ঈ|য়|য়)[ীি]?ফ\s*(?:হাদ[ীি]স\s*)?সিরিজ)/iu },
    { id: 'silsilasahih', hbdSlug: null, re: /(?:সিলসিলা\s*সহ[ীি]হাহ?|silsila\s*sahih)/iu },
    { id: 'hundredsunnah', hbdSlug: null, re: /(?:(?:১০০|100)\s*সুসাব্যস্ত\s*হাদ[ীি]স)/iu },
    { id: 'fazayeleamal', hbdSlug: null, re: /(?:সহ[ীি]হ\s*ফা[যজ]া(?:য়|য়)েলে?\s*আমল)/iu },
    { id: 'hadisequdsi', hbdSlug: 'qudsi40', re: /(?:হাদ[ীি]সে?\s*কুদস[ীি]|qudsi)/iu },
    { id: 'nawawi', hbdSlug: 'nawawi40', re: /(?:ন(?:ব|ও)(?:ব|য়া|য়া)ব?[ীি]র?\s*(?:চল্লিশ|৪০|40)\s*হাদ[ীি]স|চল্লিশ\s*হাদ[ীি]স|nawawi)/iu },
    { id: 'riyad', hbdSlug: 'riyadus-salihin', re: /(?:রি(?:য়|য়)াদুস\s*সালেহ[ীি]ন|রি(?:য়|য়)াদুস\s*সালিহ[ীি]ন|riyad\s*as[\s\-]*salihin|riyadus\s*salihin)/iu },
    { id: 'bulug', hbdSlug: 'bulugul-maram', re: /(?:বুলুগুল\s*মারাম|বুলূগুল\s*মারাম|bulugh?\s*(?:al[\s\-]*)?maram|bulugul\s*maram)/iu },
    { id: 'adabul', hbdSlug: 'al-adabul-mufrad', re: /(?:আদাবুল\s*মুফরাদ|adab\s*(?:al[\s\-]*)?mufrad|adabul\s*mufrad)/iu },
    { id: 'muwatta', hbdSlug: 'muwatta-malik', re: /(?:মু(?:ও|ওয়া|ওয়া)ত্তা\s*(?:ইমাম\s*)?মাল[েি]ক|muwatta)/iu },
    { id: 'luluwal', hbdSlug: 'al-lulu-wal-marjan', re: /(?:লু.?লু\s*ওয়াল\s*মারজান|lulu\s*wal\s*marjan)/iu },
    { id: 'targib', hbdSlug: null, re: /(?:তারগ[ীি]ব\s*ওয়াত?\s*তাহর[ীি]ব|আত[\s\-]*তারগ[ীি]ব|targib)/iu },
    { id: 'darimimirror', hbdSlug: null, re: /(?:সুনান[ে]?\s*(?:আদ[\s\-]*)?দারেম[ীি]|দারিম[ীি]|darimi)/iu },
    { id: 'bukhari', hbdSlug: 'bukhari', re: /(?:সহ[ীি]হ\s*বুখার[ীি]|বুখার[ীি]\s*(?:শর[ীি]ফ)?|bukhari)/iu },
    { id: 'muslim', hbdSlug: 'muslim', re: /(?:সহ[ীি]হ\s*মুসলিম|মুসলিম\s*শর[ীি]ফ|(?:হাদ[ীি]স|বর্ণনা).*মুসলিম|মুসলিম(?:\s*এর)?\s*[০-৯0-9]+|sahih\s*muslim)/iu },
    { id: 'tirmidhi', hbdSlug: 'tirmidhi', re: /(?:জামে?\s*তিরমি[যজ][ীি]|সুনান[ে]?\s*তিরমি[যজ][ীি]|তিরমি[যজ][ীি]|tirmidhi|tirmizi)/iu },
    { id: 'abudawud', hbdSlug: 'abu-dawud', re: /(?:সুনান[ে]?\s*আব[ুূ]\s*দা[উঊ]দ|আব[ুূ]\s*দা[উঊ]দ|abu\s*dawu?d)/iu },
    { id: 'nasai', hbdSlug: 'nasai', re: /(?:সুনান[ে]?\s*নাসা[ঈই]|নাসা[ঈই]|nasai)/iu },
    { id: 'ibnmajah', hbdSlug: 'ibn-majah', re: /(?:সুনান[ে]?\s*ইবন[েু]?\s*মাজাহ?|ইবন[েু]?\s*মাজাহ?|ibn\s*majah?)/iu },
    { id: 'mishkat', hbdSlug: 'mishkatul-masabih', re: /(?:মিশকাতুল\s*মাসাব[ীি]হ|মিশকাত|মেসকাত|mishkat)/iu },
  ];

  async function getHadithIndex() {
    const key = 'parsed:scripture-hadith-index';
    if (cacheMap.has(key)) return cacheMap.get(key);
    const p = fetchWithFallback('scripture-hadith-index.js', true)
      .then((txt) => parseWindowScriptJson(txt, 'HADITH_INDEX'))
      .catch(() => null);
    cacheMap.set(key, p);
    return p;
  }

  async function lookupHadithByBookAndNumber(bookId, num) {
    const idx = await getHadithIndex();
    const bMeta = idx && idx.books && idx.books[bookId];
    if (!bMeta || !Array.isArray(bMeta.sections)) return null;

    const candidateSecs = bMeta.sections.filter(
      (s) =>
        (num >= (s.hadithFirst || s.first) && num <= (s.hadithLast || s.last)) ||
        (num >= s.first && num <= s.last)
    );
    if (!candidateSecs.length && num >= 1 && num <= bMeta.total) {
      // Nearest neighbor section fallback
      for (const s of bMeta.sections) {
        if (Math.abs((s.hadithFirst || s.first) - num) <= 25 || Math.abs((s.hadithLast || s.last) - num) <= 25) {
          candidateSecs.push(s);
        }
      }
    }
    for (const sec of candidateSecs.slice(0, 3)) {
      const rows = await fetchGunzipJson(`scripture-hadith-${bookId}-${sec.id}.json.gz`).catch(() => null);
      if (!Array.isArray(rows)) continue;
      const exactByPrinted = rows.find((r) => Number(r[1]) === num || String(r[2]).trim() === String(num));
      const exactByInternal = rows.find((r) => Number(r[0]) === num);
      const hit = exactByPrinted || exactByInternal;
      if (hit) {
        return { bookId, bookMeta: bMeta, section: sec, row: hit };
      }
    }
    return null;
  }

  function formatHadithRecordCard(found, hbdSlug, rank = 1) {
    const { bookId, bookMeta, section, row } = found;
    // fields: ["i","n","an","bn","ar","en","r","g","note","dup","sectionTitle"]
    const iNum = row[0];
    const hNum = row[1] || iNum;
    const bnText = String(row[3] || '').trim();
    const arText = String(row[4] || '').trim();
    const narrator = String(row[6] || '').trim();
    const grade = String(row[7] || '').trim();
    const note = String(row[8] || '').trim();
    const chapTitle = String(row[10] || (section && section.name) || '').trim();

    const dawahxUrl = `${SITE_URL}/hadith.html#/hadith2/${encodeURIComponent(bookId)}/${iNum}`;
    const hadithBdUrl = hbdSlug ? `https://www.hadithbd.com/hadith/filter/?book=${encodeURIComponent(hbdSlug)}&hadith=${hNum}` : 'https://www.hadithbd.com/';
    const titleLabel = `${bookMeta.bn} — হাদীস নং ${toBnDigitsStr(hNum)}${grade ? ` (${grade})` : ''}`;

    const fullBody = [
      `গ্রন্থ: ${bookMeta.bn}${chapTitle ? ` · অধ্যায়: ${chapTitle}` : ''}`,
      `হাদীস নং: ${toBnDigitsStr(hNum)}${grade ? ` · মান (তাহকীক): ${grade}` : ''}${narrator ? ` · বর্ণনাকারী: ${narrator}` : ''}`,
      arText ? `\nআরবি মূলপাঠ:\n${arText}` : '',
      bnText ? `\nবাংলা অনুবাদ:\n${bnText}` : '',
      note ? `\nব্যাখ্যা ও টীকা:\n${note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      iNum,
      hNum,
      bnText,
      arText,
      narrator,
      grade,
      note,
      chapTitle,
      dawahxUrl,
      hadithBdUrl,
      titleLabel,
      fullBody,
      sourceCard: {
        rank,
        key: `dx_h_${bookId}_${iNum}`,
        title: titleLabel,
        clean_title: titleLabel,
        source_code: 'dx_hadith',
        source_name: `DAWAH X আল-হাদীস · ${bookMeta.short || bookMeta.bn}`,
        category: chapTitle || bookMeta.bn,
        doc_type: 'hadith',
        dawahx_url: dawahxUrl,
        share_url: dawahxUrl,
        confidence: 1.0,
        excerpt: trimCleanly(bnText || arText, 230),
        full_text: fullBody,
      },
      extCard: hbdSlug
        ? {
            provider: 'hadithbd',
            provider_name: 'HadithBD.com',
            badge: 'আল-হাদীস · HadithBD.com',
            book_name: bookMeta.bn,
            hadith_no: toBnDigitsStr(hNum),
            chapter: chapTitle,
            grade,
            title: `${bookMeta.bn} — হাদীস ${toBnDigitsStr(hNum)} (HadithBD.com)`,
            arabic: trimCleanly(arText, 500),
            bengali: trimCleanly(bnText, 520),
            url: hadithBdUrl,
            full_text: fullBody,
          }
        : null,
    };
  }

  async function resolveDawahXHadithDirect(question, t0) {
    const q = String(question || '').trim();

    // Famous Named Prophetic Dua-Hadith Verbatim Lookups from DAWAH X Hadith Corpus
    const isConditionalFiqhQ = /(?:জা(?:য়|য়)ে[যজ]\s*কি|বিধান\s*ক[িী]|হুকুম\s*ক[িী]|ছালাতের?\s*মধ্যে|নামাজের?\s*মধ্যে|সকাল\s*আর\s*সন্ধ্যা\s*কখন|একাকী\s*প(?:ড়|ড়)া)/iu.test(q);
    if (!isConditionalFiqhQ && /(?:সাই(?:য়্য|য়্য|য়|য়)[িে]দুল|সা(?:য়্য|য়্য)িদুল)\s*(?:ইস্তিগফার|ইস্তেগফার)/iu.test(q)) {
      const found = await lookupHadithByBookAndNumber('bukhari', 6306);
      if (found) {
        const formatted = formatHadithRecordCard(found, 'bukhari', 1);
        return {
          mode: 'direct',
          payload: {
            status: 'answered',
            is_chat: false,
            is_verbatim_card: true,
            query: q,
            headline: `সাইয়্যিদুল ইস্তিগফার — ${formatted.titleLabel}`,
            direct_answer: `**সাইয়্যিদুল ইস্তিগফার (ক্ষমা প্রার্থনার শ্রেষ্ঠ দোয়া) — ${formatted.titleLabel}**`,
            explanation_paragraphs: [
              formatted.arText || '',
              `**বাংলা অনুবাদ:** ${formatted.bnText}`,
              formatted.note ? `**টীকা:** ${trimCleanly(formatted.note, 380)}` : '',
            ].filter(Boolean),
            additional_perspectives: [],
            evidences: [
              {
                type: 'hadith',
                citation: formatted.titleLabel,
                arabic: formatted.arText || '',
                translation: trimCleanly(formatted.bnText, 380),
              },
            ],
            sources: [formatted.sourceCard],
            external_sources: formatted.extCard ? [formatted.extCard] : [],
            videos: [],
            rag_context: [{ rank: 1, title: `সাইয়্যিদুল ইস্তিগফার (${formatted.titleLabel})`, source: 'DAWAH X আল-হাদীস', category: 'দুআ', snippet: trimCleanly(formatted.fullBody, 1750) }],
            follow_ups: ['সকাল-সন্ধ্যার মাসনূন যিকিরগুলো কী কী?', 'ঘুমানোর আগের দোয়া কী?', 'খাওয়ার শুরু ও শেষের দোয়া বলো'],
            confidence: 0.99,
            latency_ms: Math.max(1, Math.round(performance.now() - t0)),
            ask_team_url: `${SITE_URL}/ask.html`,
          },
        };
      }
    }

    if (!isConditionalFiqhQ && /(?:খা(?:ও|ওয়া|ওয়া)র?|খাবার|আহার).*(?:শুরু|শেষ).*(?:দো(?:য়|য়)া|দু(?:য়|য়)া|দো.?আ|দু.?আ)/iu.test(q)) {
      const [beforeEat, afterEat] = await Promise.all([
        lookupHadithByBookAndNumber('abudawud', 3767),
        lookupHadithByBookAndNumber('tirmidhi', 3458),
      ]);
      if (beforeEat && afterEat) {
        const f1 = formatHadithRecordCard(beforeEat, 'abudawud', 1);
        const f2 = formatHadithRecordCard(afterEat, 'tirmidhi', 2);
        return {
          mode: 'direct',
          payload: {
            status: 'answered',
            is_chat: false,
            is_verbatim_card: true,
            query: q,
            headline: 'খাওয়ার শুরু ও শেষের সহীহ দোয়া (DAWAH X আল-হাদীস)',
            direct_answer: '**খাওয়ার শুরু ও শেষের মাসনূন দোয়া — সহীহ হাদীসের দলিলসহ:**',
            explanation_paragraphs: [
              `**১. খাওয়ার শুরুর দোয়া (${f1.titleLabel}):**\n${f1.arText ? f1.arText + '\n' : ''}${f1.bnText}`,
              `**২. খাওয়ার শেষের দোয়া (${f2.titleLabel}):**\n${f2.arText ? f2.arText + '\n' : ''}${f2.bnText}`,
            ],
            additional_perspectives: [],
            evidences: [
              { type: 'hadith', citation: f1.titleLabel, arabic: f1.arText || '', translation: trimCleanly(f1.bnText, 320) },
              { type: 'hadith', citation: f2.titleLabel, arabic: f2.arText || '', translation: trimCleanly(f2.bnText, 320) },
            ],
            sources: [f1.sourceCard, f2.sourceCard],
            external_sources: [f1.extCard, f2.extCard].filter(Boolean),
            videos: [],
            rag_context: [
              { rank: 1, title: f1.titleLabel, source: f1.sourceCard.source_name, category: 'পানাহার', snippet: trimCleanly(f1.fullBody, 1100) },
              { rank: 2, title: f2.titleLabel, source: f2.sourceCard.source_name, category: 'দুআ', snippet: trimCleanly(f2.fullBody, 1100) },
            ],
            follow_ups: ['ঘুমানোর আগের দোয়া কী?', 'সাইয়্যিদুল ইস্তিগফার অর্থসহ বলো', 'বাম হাতে খাওয়া কি গুনাহ?'],
            confidence: 0.99,
            latency_ms: Math.max(1, Math.round(performance.now() - t0)),
            ask_team_url: `${SITE_URL}/ask.html`,
          },
        };
      }
    }

    let matchedBook = null;
    for (const bp of HADITH_BOOK_PATTERNS) {
      if (bp.re.test(q)) {
        matchedBook = bp;
        break;
      }
    }
    if (!matchedBook) return null;

    // Extract hadith number (ignore "৪০ হাদীস" / "১০০ সুসাব্যস্ত" book-title numbers!)
    const strippedBookNums = q
      .replace(/(?:চল্লিশ|৪০|40)\s*হাদ[ীি]স(?:ের)?/giu, 'চল্লিশ_হাদীস')
      .replace(/(?:১০০|100)\s*সুসাব্যস্ত\s*হাদ[ীি]স(?:ের)?/giu, 'শত_হাদীস');

    const numMatch =
      strippedBookNums.match(/([০-৯0-9]{1,5})\s*(?:নং|নম্বর|তম|ম|য়|য়)?\s*হাদ[ীি]স/iu) ||
      strippedBookNums.match(/হাদ[ীি]স\s*(?:নং|নম্বর)?\s*[:\-]?\s*([০-৯0-9]{1,5})/iu) ||
      strippedBookNums.match(/(?:বুখার[ীি]|মুসলিম|তিরমি[যজ][ীি]|আব[ুূ]\s*দা[উঊ]দ|নাসা[ঈই]|ইবন[েু]?\s*মাজাহ?|মিশকাত|সালেহ[ীি]ন|মারাম|কুদস[ীি]|মুফরাদ|মু(?:ও|ওয়া|ওয়া)ত্তা|bukhari|muslim|tirmidhi|nawawi)\s*[:\-,]?\s*([০-৯0-9]{1,5})(?!\s*খণ্ড)/iu);

    if (!numMatch) return null;
    const hNum = parseBnOrAsciiInt(numMatch[1]);
    if (isNaN(hNum) || hNum < 1 || hNum > 10000) return null;

    const found = await lookupHadithByBookAndNumber(matchedBook.id, hNum);
    if (!found) return null;

    const formatted = formatHadithRecordCard(found, matchedBook.hbdSlug, 1);

    // Check if the user is asking an analytical/fiqh question ABOUT this hadith (e.g. "বুখারীর ৮২২ নং হাদীসে চুল ও কাপড় গুটিয়ে নিতে নিষেধ... এর ব্যাখ্যা ও বিধান কি?")
    const strippedForCheck = strippedBookNums
      .replace(matchedBook.re, ' ')
      .replace(/[০-৯0-9]+/g, ' ')
      .replace(/(?:নং|নম্বর|তম|ম|য়|য়|হাদ[ীি]স(?:টি|টা)?|আরবি|বাংলা|অর্থসহ|অর্থ|অনুবাদ|তাহক[ীি]ক|মান|সনদ|বলো|বলুন|দাও|দিন|দেখাও|কী|কি|শোনাও|লেখো|লিখে)/giu, ' ')
      .replace(/[?।!.,:\-\s]+/g, ' ')
      .trim();

    const isAnalyticalAboutHadith = strippedForCheck.length >= 18;

    const evidenceObj = {
      text: `${formatted.arText ? formatted.arText + '\n' : ''}অনুবাদ: "${trimCleanly(formatted.bnText, 650)}"`,
      source_title: formatted.titleLabel,
      source_name: `DAWAH X আল-হাদীস · ${found.bookMeta.bn}`,
      dawahx_url: formatted.dawahxUrl,
    };
    const ragEntry = {
      citation: `[হাদীস] ${formatted.titleLabel} — DAWAH X (${formatted.dawahxUrl})`,
      content: formatted.fullBody.slice(0, 3200),
    };

    if (isAnalyticalAboutHadith) {
      return {
        mode: 'enrich',
        sourceCard: formatted.sourceCard,
        extCard: formatted.extCard,
        evidences: [evidenceObj],
        ragEntry,
      };
    }

    const expl = [];
    if (formatted.chapTitle || formatted.grade || formatted.narrator) {
      expl.push(
        [
          formatted.chapTitle ? `• **অধ্যায়:** ${formatted.chapTitle}` : '',
          formatted.narrator ? `• **বর্ণনাকারী সাহাবী/রাবী:** ${formatted.narrator}` : '',
          formatted.grade ? `• **হাদীসের মান (তাহকীক):** ${formatted.grade}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
    if (formatted.note) {
      expl.push(`**ব্যাখ্যা ও টীকা:**\n${trimCleanly(formatted.note, 1100)}`);
    }

    return {
      mode: 'direct',
      payload: {
        status: 'answered',
        is_chat: false,
        is_verbatim_card: true,
        query: question,
        headline: formatted.titleLabel,
        primary_source: 'dx_hadith',
        primary_source_code: 'dx_hadith',
        primary_source_name: `DAWAH X আল-হাদীস · ${found.bookMeta.bn}`,
        primary_doc_type: 'hadith',
        direct_answer: `আলহামদুলিল্লাহ, **${formatted.titleLabel}** নিচে হুবহু তুলে ধরা হলো:\n\n${formatted.arText ? `${formatted.arText}\n\n` : ''}**বাংলা অনুবাদ:**\n${formatted.bnText}`,
        explanation_paragraphs: expl,
        additional_perspectives: [],
        evidences: [evidenceObj],
        sources: [formatted.sourceCard],
        external_sources: formatted.extCard ? [formatted.extCard] : [],
        videos: [],
        follow_ups: [
          `${found.bookMeta.bn}-এর ${toBnDigitsStr(Math.min(found.bookMeta.total, hNum + 1))} নং হাদীসটি কী?`,
          'DAWAH X এ কয়টি হাদীস গ্রন্থ রয়েছে?',
          'সহীহ হাদীস চেনার উপায় কী?',
        ],
        rag_context: [ragEntry],
        confidence: 1.0,
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        ask_team_url: `${SITE_URL}/ask.html`,
      },
    };
  }

  // 32-Shard FNV-1a Hadith Topic Search over DAWAH X's 40,287 indexed hadiths
  function hadithSearchShardOf(prefix, shards = 32) {
    let h = 0x811c9dc5;
    for (let i = 0; i < prefix.length; i++) {
      h ^= prefix.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % shards;
  }

  function toHadithSearchPrefix(word) {
    const nfc = String(word || '')
      .normalize('NFC')
      .replace(/\u09AF\u09BC/g, '\u09DF')
      .replace(/\u09A1\u09BC/g, '\u09DC')
      .replace(/\u09A2\u09BC/g, '\u09DD')
      .replace(/য়/g, 'য়')
      .replace(/ড়/g, 'ড়')
      .replace(/ঢ়/g, 'ঢ়');
    return nfc.length >= 4 ? nfc.slice(0, 4) : '';
  }

  const HADITH_META_SLUG_TO_ID = {
    'abu-dawud': 'abudawud',
    'ibn-majah': 'ibnmajah',
  };
  const HADITH_BOOK_PRIORITY = {
    bukhari: 1.25,
    muslim: 1.24,
    riyad: 1.18,
    abudawud: 1.14,
    tirmidhi: 1.14,
    nasai: 1.13,
    ibnmajah: 1.11,
    mishkat: 1.12,
    bulug: 1.12,
    nawawi: 1.16,
    hadisequdsi: 1.14,
    adabul: 1.10,
    muwatta: 1.09,
    luluwal: 1.16,
  };

  async function searchDawahXHadithCorpus(conceptGroups, question, videos, t0) {
    if (!Array.isArray(conceptGroups) || !conceptGroups.length) return null;
    try {
      const [hsMeta, hIdx] = await Promise.all([
        fetchWithFallback('hadith-search/meta.json'),
        getHadithIndex(),
      ]);
      if (!hsMeta || !Array.isArray(hsMeta.docs) || !hIdx || !hIdx.books) return null;

      const groupPrefs = [];
      const neededShards = new Set();

      for (const grp of conceptGroups) {
        const prefs = new Set();
        for (const t of grp.terms) {
          const p = toHadithSearchPrefix(t);
          if (p) {
            prefs.add(p);
            neededShards.add(hadithSearchShardOf(p, hsMeta.shards || 32));
          }
        }
        if (prefs.size) groupPrefs.push({ prefs, idf: grp.idf || 2.5 });
      }
      if (!groupPrefs.length) return null;

      const shardData = {};
      await Promise.all(
        [...neededShards].slice(0, 10).map(async (sh) => {
          shardData[sh] = await fetchWithFallback(`hadith-search/${String(sh).padStart(2, '0')}.json`).catch(() => null);
        })
      );

      const docScores = new Map();
      const docGroupHits = new Map();

      for (const gp of groupPrefs) {
        const hitDocs = new Set();
        for (const pref of gp.prefs) {
          const sh = shardData[hadithSearchShardOf(pref, hsMeta.shards || 32)];
          if (!sh || !sh[pref]) continue;
          const ids = decodeIds(sh[pref]);
          for (let i = 0; i < ids.length; i++) hitDocs.add(ids[i]);
        }
        if (!hitDocs.size) continue;
        const localIdf = Math.log(1 + (hsMeta.docs.length - hitDocs.size + 0.5) / (hitDocs.size + 0.5));
        for (const dId of hitDocs) {
          docScores.set(dId, (docScores.get(dId) || 0) + localIdf);
          docGroupHits.set(dId, (docGroupHits.get(dId) || 0) + 1);
        }
      }

      const minGroups = groupPrefs.length >= 2 ? Math.max(2, Math.ceil(groupPrefs.length * 0.6)) : 1;
      const ranked = [];
      for (const [dId, sc] of docScores.entries()) {
        const gHits = docGroupHits.get(dId) || 0;
        if (gHits < minGroups) continue;
        const tuple = hsMeta.docs[dId];
        if (!tuple) continue;
        const rawSlug = hsMeta.books[tuple[0]] || '';
        const bookId = HADITH_META_SLUG_TO_ID[rawSlug] || rawSlug;
        const prio = HADITH_BOOK_PRIORITY[bookId] || 0.92;
        ranked.push([sc * prio * (1 + 0.2 * gHits), bookId, tuple[1], tuple[2]]);
      }
      if (!ranked.length) return null;
      ranked.sort((a, b) => b[0] - a[0]);

      const asksWeakCheck = /(?:যঈফ|জাল|দুর্বল|সহীহ\s*নাকি|ভিত্তিহীন)/iu.test(question);
      const picked = [];
      for (const [, bookId, secId, iNum] of ranked.slice(0, 8)) {
        const bMeta = hIdx.books[bookId];
        if (!bMeta) continue;
        const rows = await fetchGunzipJson(`scripture-hadith-${bookId}-${secId}.json.gz`).catch(() => null);
        if (!Array.isArray(rows)) continue;
        const row = rows.find((r) => Number(r[0]) === Number(iNum));
        if (!row || !row[3]) continue;
        const gradeStr = String(row[7] || '');
        if (!asksWeakCheck && /(?:জাল|মাওযূ|যঈফ|দুর্বল|মুনকার|বাতিল)/u.test(gradeStr)) continue;
        const secObj = (bMeta.sections || []).find((s) => Number(s.id) === Number(secId)) || { id: secId, name: row[10] || '' };
        const bp = HADITH_BOOK_PATTERNS.find((x) => x.id === bookId);
        picked.push(formatHadithRecordCard({ bookId, bookMeta: bMeta, section: secObj, row }, bp ? bp.hbdSlug : null, picked.length + 1));
        if (picked.length >= 3) break;
      }

      if (!picked.length) return null;
      const top = picked[0];

      return {
        status: 'answered',
        is_chat: false,
        query: question,
        headline: `${top.titleLabel}${top.chapTitle ? ` · ${top.chapTitle}` : ''}`,
        primary_source: 'dx_hadith',
        primary_source_code: 'dx_hadith',
        primary_source_name: top.sourceCard.source_name,
        primary_doc_type: 'hadith',
        direct_answer: `আলহামদুলিল্লাহ, আপনার প্রশ্নের আলোকে **DAWAH X আল-হাদীস** গ্রন্থাগার থেকে প্রামাণ্য হাদীস নিচে তুলে ধরা হলো:\n\n**${top.titleLabel}:**\n${top.arText ? `${top.arText}\n\n` : ''}"${trimCleanly(top.bnText, 850)}"`,
        explanation_paragraphs: picked.slice(1).map(
          (p) => `**সহায়ক হাদীস — ${p.titleLabel}:**\n"${trimCleanly(p.bnText, 520)}"`
        ),
        additional_perspectives: [],
        evidences: picked.map((p) => ({
          text: `${p.arText ? p.arText + '\n' : ''}অনুবাদ: "${trimCleanly(p.bnText, 550)}"`,
          source_title: p.titleLabel,
          source_name: p.sourceCard.source_name,
          dawahx_url: p.dawahxUrl,
        })),
        sources: picked.map((p) => p.sourceCard),
        external_sources: picked.map((p) => p.extCard).filter(Boolean),
        videos: videos || [],
        follow_ups: [
          'DAWAH X এ কয়টি হাদীস গ্রন্থ রয়েছে?',
          'সহীহ হাদীস চেনার উপায় কী?',
        ],
        rag_context: picked.map((p, idx) => ({
          citation: `[${idx + 1}] ${p.titleLabel} — DAWAH X (${p.dawahxUrl})`,
          content: p.fullBody.slice(0, 2200),
        })),
        confidence: 0.78,
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        ask_team_url: `${SITE_URL}/ask.html`,
      };
    } catch (_) {
      return null;
    }
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

    getPrayerTimes(cityInput = 'dhaka', dateObj = new Date(), asrMethod = null) {
      return computePrayerSchedule(cityInput, dateObj, asrMethod);
    },

    getHijriDate(dateObj = new Date()) {
      return getHijriDateBn(dateObj);
    },

    findNearestCity(lat, lon) {
      return findNearestCityByCoords(lat, lon);
    },

    suggest(inputText, limit = 5) {
      const raw = String(inputText || '').trim();
      if (raw.length < 2) return [];
      const expanded = translateBanglishAndEnglish(raw);
      const qFold = foldBn(expanded).trim();
      const qToks = tokenizeFolded(expanded, true).filter((t) => t.length >= 2);
      const scored = [];
      for (const item of SUGGESTION_BANK) {
        const iFold = foldBn(item);
        let sc = 0;
        if (iFold.startsWith(qFold)) sc += 10;
        else if (qFold.length >= 2 && iFold.includes(qFold)) sc += 6;
        for (const qt of qToks) {
          if (iFold.includes(qt)) sc += 3;
          const syns = SYNONYM_MAP.get(qt);
          if (syns) {
            for (const syn of syns) {
              if (iFold.includes(syn)) { sc += 2.2; break; }
            }
          }
        }
        if (sc > 0 && item !== raw) scored.push([sc, item]);
      }
      scored.sort((a, b) => b[0] - a[0]);
      return scored.slice(0, limit).map((x) => x[1]);
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
              is_deterministic_tool: true,
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

      // v22.0 Step A: DAWAH X Site Info, Contact, Policy & 102-Volume Islamic Books Responder
      if (sourceFilter === 'all') {
        const siteOrBookResp = await resolveDawahXSiteAndBooks(contextualQuery, this, t0).catch(() => null);
        if (siteOrBookResp) return siteOrBookResp;
      }

      // v22.0 Step B & C: Verbatim DAWAH X 114-Surah Quran/Tafsir & 28-Book Hadith Lookup
      let quranEnrich = null;
      let hadithEnrich = null;
      if (sourceFilter === 'all') {
        const qRes = await resolveDawahXQuranScripture(contextualQuery, t0).catch(() => null);
        if (qRes && qRes.mode === 'direct') return qRes.payload;
        if (qRes && qRes.mode === 'enrich') quranEnrich = qRes;

        const hRes = await resolveDawahXHadithDirect(contextualQuery, t0).catch(() => null);
        if (hRes && hRes.mode === 'direct') return hRes.payload;
        if (hRes && hRes.mode === 'enrich') hadithEnrich = hRes;
      }

      // Guard: Pure secular live-utility / sports-score / fare / coding / recipe queries without Islamic framing
      const isSecularUtility =
        /(?:ম্যাচের?\s*স্কোর|খেলার?\s*স্কোর|লাইভ\s*স্কোর|(?:ট্রেনের?|বাসের?|বিমানের?|লঞ্চের?)\s*(?:টিকেট\s*|টিকিট\s*)?ভাড়া\s*কত|আবহাওয়া\s*কেমন|তাপমাত্রা\s*কত|(?:বিরিয়ানি|খিচুড়ি|কেক|রান্না\s*করার)\s*রেসিপি|(?:পাইথন|পাইথনে|জাভাস্ক্রিপ্ট|রিয়্যাক্ট|প্রোগ্রামিং).*কোড)/iu.test(
          question
        );
      const hasIslamicFraming =
        /(?:ইসলাম|শরীআত|শরীয়ত|জায়েয|জায়েজ|হালাল|হারাম|গুনাহ|পাপ|সওয়াব|ছওয়াব|বিধান|হুকুম|মাসআলা|ফতোয়া|কুরআন|হাদীস|হাদিস|সুন্নাত|সুন্নাহ)/iu.test(
          question
        );
      if (isSecularUtility && !hasIslamicFraming) {
        return this._notFoundPayload(question, [], [], t0);
      }

      // Stage 1: Linguistic expansion & Concept-Group shard retrieval
      const augQuery = translateBanglishAndEnglish(stripLeadingGreeting(contextualQuery));
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

      const SPOKEN_BN_VERB_ENDINGS = ['বেন', 'ছেন', 'তেন', 'বো', 'বে', 'বা', 'বি', 'ছি', 'ছে', 'তে', 'লে'];
      const expandSpokenVerbForms = (tok) => {
        const extra = [];
        if (!/[\u0980-\u09FF]/.test(tok)) return extra;
        // Participle 'ে' -> 'া' harmony (e.g., বেঁধে -> বাঁধা)
        if (tok.endsWith('ে') && [...tok].length >= 3 && tok.includes('\u09C7')) {
          extra.push(tok.replace('\u09C7', '\u09BE').slice(0, -1) + 'া');
        }
        for (const suf of SPOKEN_BN_VERB_ENDINGS) {
          if (tok.endsWith(suf)) {
            const vRoot = tok.slice(0, -suf.length);
            if ([...vRoot].length >= 2) {
              const roots = [vRoot];
              if (vRoot.includes('\u09C1')) roots.push(vRoot.replace('\u09C1', '\u09CB')); // তুল -> তোল, শুন -> শোন
              if (vRoot.includes('\u09BF')) roots.push(vRoot.replace('\u09BF', '\u09C7')); // শিখ -> শেখ, ছিড় -> ছেড়
              for (const r of roots) {
                extra.push(r + 'া', r + 'তে', r + 'ে');
                if ([...r].length === 1 || r.endsWith('\u09C1') || r.endsWith('\u09CB')) {
                  extra.push(r + 'ওয়া');
                }
              }
            }
            break;
          }
        }
        return extra;
      };

      for (const cs of coreStems) {
        const terms = new Set([cs]);
        for (const vf of expandSpokenVerbForms(cs)) {
          terms.add(vf);
          terms.add(stemBn(vf));
        }
        for (const baseTerm of [...terms]) {
          if (SYNONYM_MAP.has(baseTerm)) {
            for (const syn of SYNONYM_MAP.get(baseTerm)) {
              terms.add(syn);
              terms.add(stemBn(syn));
            }
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
        grp.titleHits = titleHits;
        grp.bodyHits = bodyHits;
      }

      for (const grp of conceptGroups) {
        const { titleHits, bodyHits } = grp;
        const unionCount = Math.max(titleHits.size, bodyHits.size);
        if (unionCount === 0) {
          // Unknown/unmatched token in DAWAH X gets true max corpus IDF (~9.8) so OOD queries cleanly abstain!
          grp.idf = 9.8;
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
        // Quick side bit pre-filter when fatwa/dawah or single-publication filter requested
        const isFatwaSide = ((this.sideBytes[id >> 3] || 0) >> (id & 7)) & 1;
        if ((sourceFilter === 'dawah' || ['fm', 'ra', 'iz', 'ia', 'ik'].includes(sourceFilter)) && isFatwaSide === 1) {
          continue; // exclude 'at' & 'ai'
        }
        if (['at', 'ai'].includes(sourceFilter) && isFatwaSide === 0) {
          continue; // include only 'at' & 'ai'
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
      const s1Limit = ['at', 'ai', 'ik', 'fm', 'ra', 'iz', 'ia', 'article'].includes(sourceFilter) ? 56 : 24;
      const topStage1 = stage1.slice(0, s1Limit);
      const pickedIds = new Set(topStage1.map((x) => x[0]));
      for (const bc of bodyCompletePool.slice(0, 6)) {
        if (!pickedIds.has(bc[0])) {
          topStage1.push(bc);
          pickedIds.add(bc[0]);
        }
      }

      if (!topStage1.length) {
        const hFallback = await searchDawahXHadithCorpus(conceptGroups, contextualQuery, [], t0);
        if (hFallback) return hFallback;
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
      const NARROW_SUBCASE_GUARDS = [
        [/উটের?\s*গোশত/u, /উট|গোশত/u],
        [/কৃমি\s*বের/u, /কৃমি/u],
        [/ধূমপান\s*করলে\s*ওযূ/u, /ওযূ|ওযু|অজু/u],
        [/দুধ\s*পান/u, /দুধ/u],
        [/হাঁটুর?\s*উপরে/u, /হাঁটু/u],
        [/ছানা\s*পড়/u, /ছানা|সানা/u],
        [/জুতা\s*পরে/u, /জুতা|স্যান্ডেল/u],
        [/হিজড়া/u, /হিজড়া/u],
        [/সম্মিলিতভাবে\s*মুনাজাত/u, /মুনাজাত|মোনাজাত/u],
        [/প্রথম\s*বৈঠকে/u, /প্রথম\s*বৈঠক|আত্তাহিয়্যাতু|তাশাহহুদ/u],
        [/মুখে\s*ও\s*নাকে/u, /মুখ|নাক|কুলি/u],
        [/ইমামের\s*পিছনে/u, /ইমাম|পিছনে|মুক্তাদী/u],
        [/(?:যে\s*বি(?:য়|য়)েতে|বি(?:য়|য়)ের\s*অনুষ্ঠানে)/u, /বি(?:য়|য়)ে|অনুষ্ঠান|দাওয়াত/u],
        [/(?:এইচ\.?আর|এজেন্ট\s*হিসাবে\s*কাজ)/u, /এজেন্ট|চাকরি|কাজ/u],
        [/যুক্তরাষ্ট্রে|জরিমানা|বিশ্বে\s*[০-৯0-9]+ম/u, /যুক্তরাষ্ট্র|আমেরিকা|জরিমানা|বিশ্ব/u],
      ];

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
        const missingTopSubjPenalty =
          topSubjHit === 0 && sortedGroups[0] && sortedGroups[0].idf >= 3.2 ? -0.26 : 0.0;

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
        for (const [docRe, qRe] of NARROW_SUBCASE_GUARDS) {
          if (docRe.test(doc.clean_title) && !qRe.test(question)) {
            specificityAdj -= 0.22;
          }
        }
        if (!/(?:জানাযা|জানাজা)/u.test(question) && /জানাযার?\s*ছালাত/u.test(doc.clean_title)) {
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
          missingTopSubjPenalty +
          specificityAdj;

        if (cov < 0.30 && topSubjHit === 0) conf *= 0.35;
        doc.raw_score = conf;
        conf = Math.min(0.98, Math.max(0.02, conf));

        doc.confidence = Number(conf.toFixed(4));
        doc.core_coverage = Number(cov.toFixed(3));
        reranked.push(doc);
      }

      reranked.sort((a, b) => (b.raw_score ?? b.confidence) - (a.raw_score ?? a.confidence));
      const [videos, seriesIdx] = await Promise.all([
        this.searchVideos(conceptGroups, 4),
        this.getSeriesIndex(),
      ]);

      const minCoreCov = conceptGroups.length >= 4 ? 0.42 : 0.32;
      if (!reranked.length || reranked[0].confidence < 0.36 || reranked[0].core_coverage < minCoreCov) {
        const hFallback = await searchDawahXHadithCorpus(conceptGroups, contextualQuery, videos, t0);
        if (hFallback) return hFallback;
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

      const selectedParas = selectBestParagraphs(proseDoc, coreSet, expSet, 7, 2800);
      let directAnswer = selectedParas[0] || trimCleanly(proseDoc.opening_ruling, 650);
      let expStartIdx = 1;
      while (
        expStartIdx < selectedParas.length &&
        (directAnswer.length < 85 || /[:ঃ\-–—]$/.test(directAnswer.trim()))
      ) {
        directAnswer = `${directAnswer} ${selectedParas[expStartIdx]}`.trim();
        expStartIdx++;
      }
      directAnswer = trimCleanly(directAnswer, 720);
      const explanationParas = selectedParas.slice(expStartIdx, expStartIdx + 5);

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

      const ragContext = citedDocs.slice(0, 4).map((c, i) => {
        const bestChunk = selectBestParagraphs(c, coreSet, expSet, 7, 2400).join('\n\n') || trimCleanly(c.answer_body, 2200);
        const qHeader = c.question_context ? `প্রশ্ন/প্রেক্ষাপট: ${trimCleanly(c.question_context, 420)}\n` : '';
        return {
          citation: `[${i + 1}] ${c.clean_title || c.title} (${c.source_name}) — ${c.dawahx_url}`,
          content: `${qHeader}উত্তর/বিস্তারিত:\n${bestChunk}`,
        };
      });

      const extraExtSources = [];
      for (const enrich of [quranEnrich, hadithEnrich]) {
        if (!enrich) continue;
        if (Array.isArray(enrich.evidences)) {
          for (const ev of enrich.evidences) {
            if (evidences.length < 6) evidences.unshift(ev);
          }
        }
        if (enrich.sourceCard && sourcesPayload.length < 6) {
          sourcesPayload.push({ ...enrich.sourceCard, rank: sourcesPayload.length + 1 });
        }
        if (enrich.extCard) extraExtSources.push(enrich.extCard);
        if (enrich.ragEntry && ragContext.length < 6) {
          ragContext.push(enrich.ragEntry);
        }
      }

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
        primary_title: primary.clean_title,
        additional_perspectives: additionalPerspectives,
        evidences,
        sources: sourcesPayload,
        external_sources: extraExtSources,
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
          'দুঃখিত, এই নির্দিষ্ট প্রশ্নটির সরাসরি দলিল **DAWAH X**, **Quran.com** কিংবা **HadithBD (বাংলা হাদিস)**-এ এই মুহূর্তে খুঁজে পাওয়া যায়নি। অনুমাননির্ভর বা যাচাইহীন তথ্য এড়াতে শুধুমাত্র এই তিনটি যাচাইকৃত উৎস থেকেই উত্তর প্রদান করা হয়।',
        explanation_paragraphs: [
          'আপনি চাইলে প্রশ্নটি একটু ভিন্ন শব্দে লিখে পুনরায় খুঁজতে পারেন, অথবা নিচের বাটনে ক্লিক করে প্রশ্নটি সরাসরি **DAWAH X টিমে** পাঠাতে পারেন।',
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
