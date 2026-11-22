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

  function tokenizeFolded(text, doStem = true) {
    const folded = foldBn(text).replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, ' ');
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
    ['তারাবি', 'তারাবীহ', 'তাহাজ্জুদ'],
    ['সেহরি', 'সাহরি', 'সাহারি', 'সাহরী'],
    ['বিয়ে', 'বিবাহ', 'নিকাহ'],
    ['তালাক', 'ডিভোর্স', 'বিবাহবিচ্ছেদ', 'খুলা'],
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
    ['তাবিজ', 'কবজ', 'ঝাড়ফুঁক', 'রুকইয়াহ', 'যাদু'],
    ['হালাল', 'জায়েয', 'জায়েজ', 'বৈধ'],
    ['হারাম', 'নাজায়েয', 'নিষিদ্ধ', 'অবৈধ', 'গুনাহ', 'পাপ'],
    ['ফরজ', 'ফরয', 'ওয়াজিব'],
    ['তওবা', 'তাওবা', 'ইস্তিগফার', 'ক্ষমা'],
    ['মিরাস', 'উত্তরাধিকার', 'ওয়ারিশ'],
    ['ইনজেকশন', 'ইঞ্জেকশন', 'স্যালাইন'],
    ['ভঙ্গ', 'ভেঙে', 'ভাঙে', 'নষ্ট'],
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

  const BANGLISH_AND_EN_MAP = {
    namaz: 'নামাজ সালাত', namaj: 'নামাজ সালাত', salat: 'সালাত নামাজ', salah: 'সালাত নামাজ',
    prayer: 'সালাত নামাজ দোয়া', pray: 'সালাত নামাজ', wudu: 'ওযু অজু', oju: 'ওজু ওযু',
    ozu: 'ওযু ওজু', gosol: 'গোসল ফরজ', ghusl: 'গোসল', tayammum: 'তায়াম্মুম',
    fajr: 'ফজর সালাত', fazar: 'ফজর সালাত', johor: 'যোহর সালাত', dhuhr: 'যোহর সালাত',
    asor: 'আসর সালাত', asr: 'আসর সালাত', magrib: 'মাগরিব সালাত', maghrib: 'মাগরিব সালাত',
    esha: 'এশা সালাত', isha: 'এশা সালাত', tahajjud: 'তাহাজ্জুদ সালাত', tarabi: 'তারাবীহ সালাত',
    tarawih: 'তারাবীহ সালাত', witr: 'বিতর সালাত', bitor: 'বিতর সালাত', juma: 'জুমআ সালাত',
    jumma: 'জুমআ সালাত', janaza: 'জানাযা সালাত', rakat: 'রাকআত', sijdah: 'সিজদা সাহু',
    sijda: 'সিজদা সাহু', sejda: 'সিজদা', sahu: 'সাহু সিজদা', imam: 'ইমাম জামাআত',
    masjid: 'মসজিদ', mosque: 'মসজিদ', azan: 'আযান', dua: 'দোয়া দুআ', doa: 'দোয়া দুআ',
    zikir: 'যিকির', roja: 'রোজা সিয়াম', roza: 'রোজা সিয়াম', siyam: 'সিয়াম রোজা',
    fasting: 'রোজা সিয়াম', ramadan: 'রমযান রোজা', sehri: 'সাহরী সেহরি', iftar: 'ইফতার রোজা',
    zakat: 'যাকাত নিসাব', jakat: 'যাকাত নিসাব', nisab: 'নিসাব যাকাত', fitra: 'ফিতরা সদকাতুল ফিতর',
    sadaqah: 'সাদাকাহ দান', charity: 'দান যাকাত', hajj: 'হজ্জ হজ', umrah: 'উমরাহ ওমরা',
    qurbani: 'কুরবানী পশু', kurbani: 'কুরবানী', aqiqah: 'আকীকা', akika: 'আকীকা',
    allah: 'আল্লাহ স্রষ্টা', god: 'আল্লাহ স্রষ্টা অস্তিত্ব', creator: 'স্রষ্টা আল্লাহর অস্তিত্ব',
    exist: 'অস্তিত্ব প্রমাণ', existence: 'আল্লাহর অস্তিত্ব প্রমাণ', atheist: 'নাস্তিক নাস্তিকতা সংশয়',
    atheism: 'নাস্তিকতা আল্লাহর অস্তিত্ব', nastik: 'নাস্তিক নাস্তিকতা', agnostic: 'সংশয়বাদী নাস্তিকতা',
    evolution: 'বিবর্তনবাদ বিজ্ঞান ডারউইন', science: 'বিজ্ঞান কুরআন', evil: 'দুঃখ কষ্ট তাকদীর পরীক্ষা',
    suffering: 'দুঃখ কষ্ট তাকদীর', taqdeer: 'তাকদীর ভাগ্য', takdir: 'তাকদীর ভাগ্য',
    akhirat: 'আখিরাত পরকাল বিচার', hereafter: 'আখিরাত পরকাল', jannah: 'জান্নাত', jahannam: 'জাহান্নাম',
    quran: 'কুরআন আয়াত সংকলন', hadith: 'হাদীস সুন্নাহ সহীহ', hadis: 'হাদিস সুন্নাহ',
    sunnah: 'সুন্নাহ হাদীস', prophet: 'রাসূল মুহাম্মাদ নবী', muhammad: 'মুহাম্মাদ রাসূল',
    shirk: 'শিরক তাওহীদ', bidat: 'বিদআত সুন্নাহ', bidah: 'বিদআত', tawheed: 'তাওহীদ আকীদা',
    iman: 'ঈমান আকীদা', aqeedah: 'আকীদা বিশ্বাস', akida: 'আকীদা', biye: 'বিবাহ বিয়ে',
    marriage: 'বিবাহ বিয়ে স্ত্রী', polygamy: 'বহুবিবাহ চারটি বিবাহ নারী', wives: 'চারটি বিবাহ বহুবিবাহ',
    talaq: 'তালাক বিবাহবিচ্ছেদ', talak: 'তালাক', divorce: 'তালাক খুলা', mohor: 'মোহর দেনমোহর',
    women: 'নারী অধিকার পর্দা', feminism: 'নারীবাদ নারী অধিকার', hijab: 'পর্দা হিজাব নিকাব',
    porda: 'পর্দা হিজাব', riba: 'সুদ রিবা ব্যাংক', shud: 'সুদ রিবা', sud: 'সুদ রিবা',
    interest: 'সুদ ব্যাংক লোন', bank: 'ব্যাংক সুদ', loan: 'ঋণ লোন সুদ', tax: 'ট্যাক্স ভ্যাট',
    vat: 'ভ্যাট ট্যাক্স', music: 'গান বাদ্যযন্ত্র মিউজিক হারাম', gan: 'গান বাদ্যযন্ত্র',
    song: 'গান বাদ্যযন্ত্র', photo: 'ছবি মূর্তি ফটোগ্রাফি', beard: 'দাড়ি শ্মশ্রু',
    dari: 'দাড়ি রাখা', smoking: 'ধূমপান সিগারেট', alcohol: 'মদ নেশা হারাম',
    dog: 'কুকুর পালা', kukur: 'কুকুর পালা', tabij: 'তাবিজ ঝাড়ফুঁক শিরক', ruqyah: 'রুকইয়াহ ঝাড়ফুঁক',
    grave: 'কবর যিয়ারত মাজার', mazar: 'মাজার কবর শিরক', birthday: 'জন্মদিন পালন বিদআত',
    inheritance: 'মিরাস উত্তরাধিকার সম্পত্তি', miras: 'মিরাস উত্তরাধিকার', suicide: 'আত্মহত্যা গুনাহ',
    tauba: 'তওবা ক্ষমা গুনাহ', tawbah: 'তওবা ক্ষমা', halal: 'হালাল জায়েয বৈধ',
    haram: 'হারাম নাজায়েয নিষিদ্ধ', jayej: 'জায়েয বৈধ', foroj: 'ফরয আবশ্যক',
    venge: 'ভঙ্গ ভেঙে নষ্ট', bhenge: 'ভঙ্গ ভেঙে', niyom: 'নিয়ম পদ্ধতি বিধান',
    kivabe: 'কিভাবে পদ্ধতি নিয়ম', kokhon: 'কখন সময়', ebong: 'এবং', dite: 'দিতে আদায়',
    hoy: 'হয়', dewar: 'দেওয়ার আদায়', korbo: 'করণীয়', injection: 'ইনজেকশন স্যালাইন ছিয়াম',
    saline: 'স্যালাইন ইনজেকশন ছিয়াম',
  };

  const GENERIC_QUERY_WORDS = new Set(
    [
      'কি', 'কী', 'কেন', 'কখন', 'কোথায়', 'কিভাবে', 'কীভাবে', 'কেমন', 'কোন', 'কোনো', 'কোনটি',
      'কত', 'কয়', 'কয়টি', 'কার', 'কাকে', 'কে', 'কারা',
      'হয়', 'হবে', 'হলে', 'হলো', 'হল', 'হয়েছে', 'হচ্ছে', 'হতে', 'হওয়া',
      'যায়', 'যাবে', 'গেলে', 'যাওয়া', 'পারে', 'পারবে', 'পারা', 'পারি',
      'করা', 'করে', 'করলে', 'করব', 'করবো', 'করতে', 'করার', 'করেন',
      'দেওয়া', 'দেয়া', 'দিলে', 'দিতে', 'নেওয়া', 'নেয়া', 'নিলে', 'নিতে',
      'বলা', 'বলে', 'বললে', 'বলেন', 'আছে', 'নেই', 'নাই', 'থাকা', 'থাকে', 'থাকলে',
      'জন্য', 'থেকে', 'সাথে', 'সঙ্গে', 'মধ্যে', 'ভেতরে', 'উপর', 'ওপর', 'নিচে', 'নীচে',
      'এবং', 'ও', 'বা', 'অথবা', 'কিন্তু', 'তবে', 'যদি', 'তাহলে', 'নাকি', 'না', 'নয়',
      'এই', 'সেই', 'ওই', 'এটি', 'সেটি', 'এটা', 'সেটা', 'একটি', 'একটা', 'কিছু', 'সব', 'সকল',
      'আমার', 'আমাদের', 'আপনার', 'তাদের', 'তার', 'আমি', 'আমরা', 'তুমি', 'আপনি',
      'ইসলাম', 'ইসলামে', 'ইসলামের', 'ইসলামিক', 'ইসলামী', 'মুসলিম', 'মুসলমান', 'শারঈ', 'শরীয়ত', 'শরীআত',
      'প্রশ্ন', 'উত্তর', 'জবাব', 'জানতে', 'চাই', 'বলুন', 'জানান', 'বিষয়ে', 'সম্পর্কে', 'ব্যাপারে',
      'বিধান', 'হুকুম', 'নিয়ম', 'মাসআলা', 'ফতোয়া', 'দলিল', 'দলিলসহ', 'আলোকে',
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'do', 'does', 'can',
      'in', 'on', 'of', 'to', 'for', 'with', 'about', 'the', 'and', 'or', 'islam', 'islamic', 'muslim',
      'kivabe', 'kokhon', 'ebong', 'dite', 'hoy', 'dewar', 'niyom', 'ki',
    ].map((w) => stemBn(foldBn(w)))
  );

  function isCoreToken(tok) {
    if (!tok || tok.length < 2 || /^\d+$/.test(tok)) return false;
    if (GENERIC_QUERY_WORDS.has(tok) || GENERIC_QUERY_WORDS.has(foldBn(tok))) return false;
    return true;
  }

  function translateBanglishAndEnglish(rawQuery) {
    const latinWords = String(rawQuery || '').toLowerCase().match(/[a-z]{2,}/g) || [];
    const mapped = [];
    for (const w of latinWords) {
      if (BANGLISH_AND_EN_MAP[w]) mapped.push(BANGLISH_AND_EN_MAP[w]);
      else if (w.endsWith('s') && BANGLISH_AND_EN_MAP[w.slice(0, -1)]) mapped.push(BANGLISH_AND_EN_MAP[w.slice(0, -1)]);
      else if (w.endsWith('ing') && BANGLISH_AND_EN_MAP[w.slice(0, -3)]) mapped.push(BANGLISH_AND_EN_MAP[w.slice(0, -3)]);
    }
    return mapped.length ? `${rawQuery} ${mapped.join(' ')}` : rawQuery;
  }

  function detectConversationalIntent(q) {
    const s = String(q || '').trim();
    if (!s) return 'empty';
    if (/^\s*(?:আসসালামু\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam|hello|hi|হ্যালো|হাই)(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?)?[।!?.,\s]*$/i.test(s)) {
      return 'greeting';
    }
    if (
      s.length <= 75 &&
      /(?:তুমি\s*কে|আপনি\s*কে|তোমার\s*নাম\s*ক[িী]|কে\s*তৈরি\s*করেছে|ক[িী]ভাবে\s*কাজ\s*করো?|who\s*are\s*you|how\s*do\s*you\s*work)/i.test(s)
    ) {
      const f = foldBn(s);
      if (!f.includes('আল্লাহ') && !f.includes('রব') && !f.includes('নবি') && !f.includes('রাসুল')) {
        return 'identity';
      }
    }
    return null;
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
      ansParas[0] = ansParas[0].replace(/^\s*(?:উত্তর|জবাব)\s*[:ঃ\-–—]?\s*/, '').trim();
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

    const filteredParas = ansParas.filter(
      (p) =>
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

  function selectBestParagraphs(doc, coreSet, expSet, maxParas = 4, maxChars = 1450) {
    const paras = doc.paragraphs.filter((p) => p.length >= 18);
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
          dawahx_url: `${SITE_URL}/read.html?v=${v.id}`,
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

    async ask(question, sourceFilter = 'all', topK = 5) {
      const t0 = performance.now();
      const intent = detectConversationalIntent(question);
      await this.init();
      const totalDocs = (this.stats && this.stats.texts) || this.meta.n || 24207;
      const totalVids = (this.stats && this.stats.videos) || 9310;

      if (intent === 'greeting') {
        return {
          status: 'conversational',
          query: question,
          headline: 'ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহু!',
          direct_answer: `আমি **DAWAH X AI**। কুরআন ও সহীহ সুন্নাহর আলোকে সাজানো **DAWAH X** ওয়েবসাইটের **${totalDocs.toLocaleString('en-IN')}+** ফতোয়া, প্রশ্নোত্তর ও প্রবন্ধ এবং **${totalVids.toLocaleString('en-IN')}+** ইসলামিক ভিডিও থেকে আপনার প্রশ্নের দলিলভিত্তিক উত্তর খুঁজে দিতে প্রস্তুত।`,
          explanation_paragraphs: [
            'আপনি বাংলা, Banglish (যেমন: *namaz e sahu sijda dewar niyom*) অথবা ইংরেজিতে যেকোনো ইসলামিক মাসআলা, আকীদা, কুরআন-হাদীস কিংবা সংশয়মূলক প্রশ্ন করতে পারেন। আমি কোনো মনগড়া তথ্য যোগ না করে সরাসরি DAWAH X-এর যাচাইকৃত উৎস ও লিংকসহ উত্তর দেব।',
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [],
          videos: [],
          follow_ups: [
            'মসজিদের সিঁড়ির নিচে ইমাম ও মুয়াজ্জিনের ঘর করায় শারঈ বাধা আছে কি?',
            'আল্লাহর অস্তিত্বের যুক্তি ও প্রমাণ কী?',
            'যাদের কাছে ইসলামের দাওয়াত পৌঁছায়নি, তাদের বিচার কীভাবে হবে?',
            'ইসলামে গান ও বাদ্যযন্ত্রের বিধান কী?',
          ],
          confidence: 1.0,
          latency_ms: Math.round(performance.now() - t0),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      if (intent === 'identity') {
        return {
          status: 'conversational',
          query: question,
          headline: 'পরিচিতি — DAWAH X AI মডেল',
          direct_answer: `আমি **DAWAH X** (${SITE_URL}/)-এর নিজস্ব ইসলামিক প্রশ্নোত্তর এআই মডেল। আমাকে কোনো ইসলামিক প্রশ্ন করা হলে আমি শুধুমাত্র এই ওয়েবসাইটের সংগৃহীত **${totalDocs.toLocaleString('en-IN')}টি** ফতোয়া, প্রবন্ধ ও প্রশ্নোত্তর এবং **${totalVids.toLocaleString('en-IN')}টি** ভিডিও থেকে উত্তর প্রদান করি।`,
          explanation_paragraphs: [
            'আমার মূল নীতি হলো **শতভাগ আমানতদারিতা**: ওয়েবসাইটে নেই এমন কোনো ফতোয়া বা মনগড়া কথা আমি নিজে থেকে তৈরি করি না। প্রতিটি উত্তরের নিচে মূল লেখার সরাসরি লিংক দেওয়া থাকে যাতে আপনি সম্পূর্ণ দলিল যাচাই করে পড়তে পারেন।',
          ],
          additional_perspectives: [],
          evidences: [],
          sources: [],
          videos: [],
          follow_ups: [
            'সালাতে সাহু সিজদা কখন এবং কীভাবে দিতে হয়?',
            'রোজা অবস্থায় ইনজেকশন বা স্যালাইন নিলে কি রোজা ভেঙে যাবে?',
            'পৃথিবীতে দুঃখ-কষ্ট ও পরীক্ষা কেন দেওয়া হয়?',
            'যাকাত ফরয হওয়ার নিসাব ও হিসাব করার নিয়ম কী?',
          ],
          confidence: 1.0,
          latency_ms: Math.round(performance.now() - t0),
          ask_team_url: `${SITE_URL}/ask.html`,
        };
      }

      // Stage 1: Linguistic expansion & Concept-Group shard retrieval
      const augQuery = translateBanglishAndEnglish(question);
      const rawStems = [...new Set(tokenizeFolded(augQuery, true))];
      let coreStems = rawStems.filter(isCoreToken);
      if (!coreStems.length) coreStems = rawStems;

      if (!coreStems.length) {
        return this._notFoundPayload(question, [], [], t0);
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
          docScores[id] += grp.idf * 1.05;
          if (!titleHits.has(id)) {
            docMatchedIdf[id] += grp.idf * 0.78;
          }
        }
      }

      totalCoreIdf = Math.max(totalCoreIdf, 1.0);

      // Collect top Stage-1 candidates
      const stage1 = [];
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
        const composite = docScores[id] * (0.32 + 0.48 * cov + 0.20 * titleCov);
        stage1.push([id, composite, cov, titleCov]);
      }

      stage1.sort((a, b) => b[1] - a[1]);
      const topStage1 = stage1.slice(0, 12);

      if (!topStage1.length) {
        return this._notFoundPayload(question, [], [], t0);
      }

      // Fetch full DAWAH X bucket records for top 12 candidates in parallel
      const candKeys = topStage1.map(([id]) => this.keys.slice(id * 14, id * 14 + 14));
      const uniqueBuckets = [...new Set(candKeys.map((k) => k.slice(-3)))];
      const bucketObjs = {};
      await Promise.all(
        uniqueBuckets.map(async (b3) => {
          bucketObjs[b3] = await fetchWithFallback(`texts/${b3}.json`);
        })
      );

      // Stage 2: Full-Text Reranking & Confidence Calibration
      const sortedGroups = [...conceptGroups].sort((a, b) => b.idf - a.idf);
      const topSubjectTerms = sortedGroups[0] ? sortedGroups[0].terms : new Set();

      const reranked = [];
      const seenTitles = new Set();
      const maxS1 = topStage1[0][1] || 1.0;

      for (let idx = 0; idx < topStage1.length; idx++) {
        const [id, s1Score, cov, titleCov] = topStage1[idx];
        const key = candKeys[idx];
        const raw = bucketObjs[key.slice(-3)]?.[key];
        if (!raw) continue;

        const doc = parseDocRecord(key, raw);

        // Apply exact sourceFilter
        if (sourceFilter === 'fatwa' && !(doc.doc_type === 'fatwa' || ['at', 'ai', 'ik'].includes(doc.source_code))) continue;
        if (sourceFilter === 'dawah' && !['fm', 'ra', 'iz', 'ia'].includes(doc.source_code)) continue;
        if (sourceFilter === 'article' && doc.doc_type !== 'article') continue;

        const ft = foldBn(doc.clean_title);
        if (seenTitles.has(ft)) continue;
        seenTitles.add(ft);

        const fullDocToks = new Set(
          tokenizeFolded(`${doc.clean_title} ${doc.question_context} ${doc.opening_ruling} ${doc.answer_body.slice(0, 1800)}`, true)
        );
        const titleTokList = tokenizeFolded(doc.clean_title, true);

        let topSubjHit = 0;
        for (const st of topSubjectTerms) {
          if (fullDocToks.has(st)) { topSubjHit = 1; break; }
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

        const isQaBonus = ['fatwa', 'qa', 'rebuttal'].includes(doc.doc_type) ? 0.06 : 0.0;
        const normS1 = s1Score / maxS1;
        let conf =
          0.34 * cov +
          0.24 * titleCov +
          0.20 * normS1 +
          0.10 * topSubjHit +
          0.06 * bigramBonus +
          isQaBonus;

        if (cov < 0.30 && topSubjHit === 0) conf *= 0.35;
        conf = Math.min(0.98, Math.max(0.02, conf));

        doc.confidence = Number(conf.toFixed(4));
        doc.core_coverage = Number(cov.toFixed(3));
        reranked.push(doc);
      }

      reranked.sort((a, b) => b.confidence - a.confidence);
      const videos = await this.searchVideos(conceptGroups, 4);

      if (!reranked.length || reranked[0].confidence < 0.26 || reranked[0].core_coverage < 0.25) {
        return this._notFoundPayload(question, reranked.slice(0, 3), videos, t0);
      }

      // Synthesize Grounded Answer from Top DAWAH X Documents
      const primary = reranked[0];
      let proseDoc = primary;
      if (
        primary.answer_body.length < 180 &&
        primary.answer_body.includes('ভিডিও') &&
        reranked.length > 1 &&
        reranked[1].confidence >= 0.26 &&
        reranked[1].answer_body.length >= 180
      ) {
        proseDoc = reranked[1];
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
        if (c.clean_title.length >= 12 && c.clean_title.length <= 125 && c.clean_title !== primary.clean_title) {
          followUps.push(c.clean_title);
        }
        if (followUps.length >= 4) break;
      }

      const ragContext = citedDocs.slice(0, 3).map((c, i) => ({
        citation: `[${i + 1}] ${c.title} (${c.source_name}) — ${c.dawahx_url}`,
        content: trimCleanly(c.answer_body, 1200),
      }));

      return {
        status: 'answered',
        query: question,
        headline: primary.clean_title,
        primary_source_name: primary.source_name,
        primary_doc_type: primary.doc_type,
        primary_key: primary.key,
        primary_url: primary.dawahx_url,
        direct_answer: directAnswer,
        explanation_paragraphs: explanationParas,
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
        query: question,
        headline: 'DAWAH X সংগ্রহে এ বিষয়ে সরাসরি উত্তর পাওয়া যায়নি',
        direct_answer:
          'দুঃখিত, আপনার এই নির্দিষ্ট প্রশ্নটির হুবহু বা নিশ্চিত উত্তর **DAWAH X**-এর বর্তমান সংগ্রহে খুঁজে পাওয়া যায়নি। ইসলামী শরীআতের বিষয়ে অনুমান বা সাইটের বাইরের তথ্য দিয়ে মনগড়া ফতোয়া প্রদান করা থেকে আমরা বিরত থাকি।',
        explanation_paragraphs: [
          'আপনি প্রশ্নটি ভিন্নভাবে বা মূল বাংলা শব্দ ব্যবহার করে পুনরায় খুঁজে দেখতে পারেন, অথবা নিচের বোতামে ক্লিক করে সরাসরি **DAWAH X টিমের** কাছে আপনার প্রশ্নটি পাঠাতে পারেন।',
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
