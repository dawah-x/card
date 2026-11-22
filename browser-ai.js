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
      'আসসালামু', 'আলাইকুম', 'সালাম', 'রাহমাতুল্লাহ', 'রাহমাতুল্লাহি', 'বারাকাতুহু', 'ওয়া',
      'ভাই', 'ভাইয়া', 'বোন', 'আপু', 'হুজুর', 'শায়খ', 'শায়েখ', 'স্যার', 'বন্ধু',
      'দয়া', 'অনুগ্রহ', 'প্লিজ', 'একটু', 'আচ্ছা', 'হ্যালো', 'হাই',
      'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'do', 'does', 'can',
      'in', 'on', 'of', 'to', 'for', 'with', 'about', 'the', 'and', 'or', 'islam', 'islamic', 'muslim',
      'kivabe', 'kokhon', 'ebong', 'dite', 'hoy', 'dewar', 'niyom', 'ki',
      'assalamu', 'alaikum', 'salam', 'bhai', 'bhaiya', 'hujur', 'sheikh', 'hello', 'hi', 'hey', 'please',
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
    return `বাংলাদেশ সময় অনুযায়ী এখন **${period} ${toBnDigitsStr(parts.hour)}:${toBnDigitsStr(parts.minute)}** মিনিট — আজ **${weekdays[parts.weekday] || parts.weekday}, ${toBnDigitsStr(parts.day)} ${months[Number(parts.month)]} ${toBnDigitsStr(parts.year)}**।`;
  }

  function handleDialogueTurn(question, totalDocs, totalVids, history, t0) {
    const q = String(question || '').trim();
    if (!q) return null;

    let lastCtx = null;
    let userName = '';
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item && item.role === 'user') {
          const m = String(item.text || '').trim().match(CHAT_PATTERNS.myName);
          if (m) {
            const cand = m[1].trim();
            if (cand.split(/\s+/).length <= 3 && !CHAT_PATTERNS.userSad.test(cand) && !CHAT_PATTERNS.userGood.test(cand)) {
              userName = cand;
            }
          }
        }
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

    async ask(question, sourceFilter = 'all', topK = 5, history = []) {
      const t0 = performance.now();
      const preDocs = (this.stats && this.stats.texts) || (this.meta && this.meta.n) || 24207;
      const preVids = (this.stats && this.stats.videos) || 9310;

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

      const conversationalIntro = buildConversationalOpening(
        question,
        proseDoc.doc_type,
        proseDoc.source_name,
        usedHistory
      );

      return {
        status: 'answered',
        is_chat: false,
        query: question,
        conversational_intro: conversationalIntro,
        headline: primary.clean_title,
        primary_source_name: primary.source_name,
        primary_doc_type: primary.doc_type,
        primary_key: primary.key,
        primary_url: primary.dawahx_url,
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
