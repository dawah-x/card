/**
 * DAWAH X AI — Zero-Key Live Multi-Source Web Search & Article Extractor for Cloudflare Workers
 *
 * Searches trusted Islamic portals (IslamQA, AlKawsar, HadithBD, As-Sunnah, IslamHouse, Sunnah.com, Quran.com)
 * as well as general open-web sources (DuckDuckGo Lite/HTML, Bengali & English Wikipedia, DuckDuckGo Instant Answer)
 * with zero paid API keys required (plus optional Brave / Tavily API key support if configured).
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WIKI_USER_AGENT = 'DawahX-AI/14.0 (https://dawah-x.github.io/card/; Islamic & General Q&A Assistant)';

const ISLAMIC_TOPIC_RE =
  /(?:ইসলাম|আল্লাহ|কুরআন|কোরআন|হাদীস|হাদিস|সুন্নাহ|সুন্নাত|নবী|রাসূল|রাসুল|সাহাবী|নামাজ|নামায|সালাত|ছালাত|রোজা|রোযা|সিয়াম|ওযু|অজু|গোসল|তায়াম্মুম|যাকাত|জাকাত|ফিতরা|হজ্জ|হজ|উমরাহ|ওমরাহ|কুরবানী|কুরবানি|আকীকা|জানাযা|জানাজা|তালাক|বিবাহ|বিয়ে|মোহর|পর্দা|হিজাব|সুদ|রিবা|হালাল|হারাম|জায়েয|জায়েজ|মাকরূহ|ফরয|ফরজ|ওয়াজিব|মুস্তাহাব|বিদআত|শিরক|কুফর|তাওহীদ|আকীদা|তওবা|দোয়া|দুআ|যিকির|তাহাজ্জুদ|তারাবীহ|বিতর|সিজদা|ইমাম|মসজিদ|মাদরাসা|ফতোয়া|মাসআলা|শরীআত|শরীয়ত|আখিরাত|জান্নাত|জাহান্নাম|কবর|মাযার|মীলাদ|শবে|রমযান|রমজান|শাওয়াল|মহররম|আশুরা|ইতিকাফ|কাফফারা|কসম|মানত|মিরাস|ফারায়েয|উত্তরাধিকার|islam|allah|quran|hadith|sunnah|prophet|muhammad|salah|namaz|fasting|ramadan|zakat|hajj|umrah|halal|haram|fatwa|fiqh|tafsir|shirk|bidah|dua|wudu|ghusl|nikah|talaq)/iu;

const TRUSTED_ISLAMIC_DOMAINS = [
  'alkawsar.com',
  'islamqa.info',
  'islamqa.org',
  'hadithbd.com',
  'assunnahfoundation.org',
  'islamhouse.com',
  'at-tahreek.com',
  'quran.com',
  'sunnah.com',
  'banglahadith.com',
  'islamicfinder.org',
  'dorar.net',
  'seekersguidance.org',
  'yaqeeninstitute.org',
];

const BLOCKED_DOMAINS_RE =
  /(?:doubleclick\.net|googleadservices|facebook\.com\/login|instagram\.com\/accounts|tiktok\.com|pinterest\.com|bet365|1xbet|casino|porn|xxx)/i;

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });
}

function stripTags(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote|section|article)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unwrapDuckDuckGoUrl(rawHref) {
  let href = decodeHtmlEntities(String(rawHref || '').trim());
  if (!href) return '';
  if (href.startsWith('//')) href = 'https:' + href;
  try {
    if (href.includes('duckduckgo.com/l/') || href.includes('uddg=')) {
      const u = new URL(href, 'https://duckduckgo.com');
      const uddg = u.searchParams.get('uddg');
      if (uddg) return uddg;
    }
    const parsed = new URL(href);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
}

function getDomainName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2800) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 1. DuckDuckGo HTML / Lite SERP Parser (Zero API Key)
async function searchDuckDuckGoHtml(query, timeoutMs = 2900) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      'https://html.duckduckgo.com/html/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        body: `q=${encodeURIComponent(query)}`,
      },
      timeoutMs
    );
    if (res.ok) {
      const html = await res.text();
      const blocks = html.split(/<div[^>]+class="[^"]*result__body[^"]*"[^>]*>/i).slice(1, 9);
      for (const blk of blocks) {
        const aMatch = blk.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        const url = unwrapDuckDuckGoUrl(aMatch[1]);
        const title = stripTags(aMatch[2]).replace(/\s+/g, ' ').trim();
        const snipMatch = blk.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const snippet = stripTags((snipMatch && (snipMatch[1] || snipMatch[2])) || '').replace(/\s+/g, ' ').trim();
        if (url && title && !BLOCKED_DOMAINS_RE.test(url)) {
          results.push({ title, url, snippet, domain: getDomainName(url), provider: 'ddg-html' });
        }
      }
    }
  } catch (_) {}

  if (results.length >= 2) return results;

  // Fallback to DuckDuckGo Lite if HTML endpoint returned fewer than 2 items
  try {
    const liteRes = await fetchWithTimeout(
      'https://lite.duckduckgo.com/lite/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'text/html',
        },
        body: `q=${encodeURIComponent(query)}`,
      },
      timeoutMs
    );
    if (liteRes.ok) {
      const lHtml = await liteRes.text();
      const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]+class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>|<a[^>]+class=['"]result-link['"][^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snipRegex = /<td[^>]+class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;
      const links = [];
      let m;
      while ((m = linkRegex.exec(lHtml)) !== null && links.length < 8) {
        links.push({ rawUrl: m[1] || m[3], rawTitle: m[2] || m[4] });
      }
      const snips = [];
      while ((m = snipRegex.exec(lHtml)) !== null && snips.length < 8) {
        snips.push(stripTags(m[1]).replace(/\s+/g, ' ').trim());
      }
      for (let i = 0; i < links.length; i++) {
        const url = unwrapDuckDuckGoUrl(links[i].rawUrl);
        const title = stripTags(links[i].rawTitle).replace(/\s+/g, ' ').trim();
        if (url && title && !BLOCKED_DOMAINS_RE.test(url)) {
          results.push({
            title,
            url,
            snippet: snips[i] || '',
            domain: getDomainName(url),
            provider: 'ddg-lite',
          });
        }
      }
    }
  } catch (_) {}

  return results;
}

// 2. Wikipedia MediaWiki Search + Plaintext Extracts API (bn.wikipedia.org + en.wikipedia.org)
async function searchWikipedia(query, lang = 'bn', timeoutMs = 2400) {
  try {
    const apiUrl =
      `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search` +
      `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=2&prop=extracts|info` +
      `&exintro=1&explaintext=1&exchars=950&inprop=url&format=json&origin=*`;
    const res = await fetchWithTimeout(
      apiUrl,
      { headers: { 'User-Agent': WIKI_USER_AGENT, Accept: 'application/json' } },
      timeoutMs
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    pages.sort((a, b) => (a.index || 99) - (b.index || 99));
    return pages
      .filter((p) => p && p.title && p.extract && p.extract.trim().length >= 45)
      .map((p) => ({
        title: `${p.title} (${lang === 'bn' ? 'উইকিপিডিয়া' : 'Wikipedia'})`,
        url: p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        snippet: String(p.extract || '').replace(/\s+/g, ' ').trim().slice(0, 900),
        domain: `${lang}.wikipedia.org`,
        provider: `wiki-${lang}`,
      }));
  } catch (_) {
    return [];
  }
}

// 3. DuckDuckGo Instant Answer JSON API (No Key)
async function searchDuckDuckGoInstant(query, timeoutMs = 2000) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': WIKI_USER_AGENT } }, timeoutMs);
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    if (data?.AbstractText && data?.AbstractURL) {
      out.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: String(data.AbstractText).trim().slice(0, 900),
        domain: getDomainName(data.AbstractURL),
        provider: 'ddg-instant',
      });
    }
    return out;
  } catch (_) {
    return [];
  }
}

// 4. Optional Paid/Freemium Search APIs if user ever configures env.TAVILY_API_KEY or env.BRAVE_API_KEY
async function searchOptionalApiProviders(query, env, timeoutMs = 2800) {
  if (env && env.TAVILY_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, max_results: 5 }),
        },
        timeoutMs
      );
      if (res.ok) {
        const d = await res.json();
        return (d.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: String(r.content || '').slice(0, 900),
          domain: getDomainName(r.url),
          provider: 'tavily',
        }));
      }
    } catch (_) {}
  }
  if (env && env.BRAVE_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY },
        },
        timeoutMs
      );
      if (res.ok) {
        const d = await res.json();
        return (d?.web?.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: stripTags(r.description || '').slice(0, 600),
          domain: getDomainName(r.url),
          provider: 'brave',
        }));
      }
    } catch (_) {}
  }
  return [];
}

// Fetch & extract clean main article text from the top matched web pages so the AI reads full context!
async function fetchCleanPageExcerpt(url, maxChars = 1650, timeoutMs = 2200) {
  try {
    if (!url || /\.pdf($|\?)/i.test(url) || /youtube\.com|youtu\.be/i.test(url)) return '';
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      },
      timeoutMs
    );
    if (!res.ok) return '';
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html') && !ctype.includes('text')) return '';

    const rawHtml = (await res.text()).slice(0, 140000);
    // Prefer <article> or <main> content if present to skip navbars/sidebars
    const mainMatch =
      rawHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
      rawHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    const targetHtml = (mainMatch ? mainMatch[1] : rawHtml)
      .replace(/<(?:nav|header|footer|aside|form|button)[\s\S]*?<\/(?:nav|header|footer|aside|form|button)>/gi, ' ');

    const text = stripTags(targetHtml);
    const paras = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 45 && !/^(?:cookie|privacy policy|all rights reserved|copyright|সর্বস্বত্ব সংরক্ষিত)/i.test(p));

    let out = '';
    for (const p of paras) {
      if (out.length + p.length > maxChars) break;
      out += (out ? '\n' : '') + p;
    }
    return out.trim();
  } catch (_) {
    return '';
  }
}

export async function gatherExternalWebContext(question, env = null) {
  const q = String(question || '').trim().slice(0, 260);
  if (!q) return { isIslamic: false, sources: [], contextBlock: '' };

  const isIslamic = ISLAMIC_TOPIC_RE.test(q);
  const hasBengali = /[\u0980-\u09FF]/.test(q);

  const tasks = [
    searchDuckDuckGoHtml(q, 2900),
    searchWikipedia(q, hasBengali ? 'bn' : 'en', 2300),
    searchDuckDuckGoInstant(q, 1900),
    searchOptionalApiProviders(q, env, 2700),
  ];

  // For Islamic questions, run a parallel targeted search across reputable Islamic fatwa/hadith portals!
  if (isIslamic) {
    const trustedQuery = `${q} (site:alkawsar.com OR site:islamqa.info OR site:hadithbd.com OR site:assunnahfoundation.org OR site:islamhouse.com OR site:sunnah.com)`;
    tasks.unshift(searchDuckDuckGoHtml(trustedQuery, 2900));
    if (hasBengali) {
      tasks.push(searchWikipedia(q, 'en', 2100));
    }
  }

  const settled = await Promise.allSettled(tasks);
  const merged = [];
  const seenUrls = new Set();

  for (const item of settled) {
    if (item.status !== 'fulfilled' || !Array.isArray(item.value)) continue;
    for (const r of item.value) {
      if (!r || !r.url || !r.title) continue;
      const normUrl = r.url.replace(/#.*$/, '').replace(/\/+$/, '');
      if (seenUrls.has(normUrl)) continue;
      // Skip DAWAH-X itself here since DAWAH-X local index was already searched in Tier 1
      if (normUrl.includes('ebrahim-ead.github.io/DAWAH-X')) continue;
      seenUrls.add(normUrl);

      let priority = 1;
      if (TRUSTED_ISLAMIC_DOMAINS.some((d) => r.domain === d || r.domain.endsWith('.' + d))) {
        priority = 3;
      } else if (r.domain.endsWith('wikipedia.org') || r.domain.endsWith('.gov.bd') || r.domain.endsWith('.edu')) {
        priority = 2;
      }
      merged.push({ ...r, priority });
    }
  }

  merged.sort((a, b) => b.priority - a.priority);
  const topSources = merged.slice(0, 5);

  // Enrich top 2 non-Wikipedia results by fetching clean article body paragraphs in parallel
  await Promise.allSettled(
    topSources.slice(0, 2).map(async (src) => {
      if (src.domain.endsWith('wikipedia.org') && src.snippet.length >= 250) {
        src.full_excerpt = src.snippet;
        return;
      }
      const deepText = await fetchCleanPageExcerpt(src.url, 1550, 2100);
      src.full_excerpt = deepText.length >= 120 ? deepText : src.snippet;
    })
  );

  const formattedSources = topSources.map((s, idx) => ({
    rank: idx + 1,
    title: s.title.slice(0, 160),
    url: s.url,
    domain: s.domain || 'web',
    snippet: (s.snippet || '').slice(0, 260),
  }));

  const contextBlock = topSources
    .map((s, idx) => {
      const body = (s.full_excerpt || s.snippet || '').slice(0, idx < 2 ? 1550 : 650);
      return `[ওয়েব সূত্র ${idx + 1}] ${s.title} (${s.domain}) — ${s.url}\nসারসংক্ষেপ/বিবরণ:\n${body}`;
    })
    .join('\n\n---\n\n');

  return {
    isIslamic,
    sources: formattedSources,
    contextBlock,
  };
}
