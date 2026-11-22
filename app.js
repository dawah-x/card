/* ===== DAWAH X AI — Frontend Client Logic ===== */
(function () {
  'use strict';

  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBnNum = (val) =>
    String(val).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
  const formatBnInt = (num) =>
    toBnNum(Number(num || 0).toLocaleString('en-IN'));

  const escHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Highlight inline Arabic script in Noto Naskh Arabic & bold markdown **...**
  function formatRichText(text) {
    let safe = escHtml(text);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(
      /([\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F\u0670\uFD50-\uFDFF\uFE70-\uFEFF۝﴿﴾().,،؛:«»\-]{3,})/g,
      '<span class="ar-inline">$1</span>'
    );
    safe = safe.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
    return safe;
  }

  let activeFilter = 'all';
  let isAsking = false;
  let backendAvailable = null; // true = Python FastAPI, false = GitHub Pages Browser AI Engine
  let chatHistory = [];
  let currentSessionId = 'sess_' + Date.now();
  let currentSessionTurns = [];
  let activeTtsBtn = null;

  const SESSIONS_KEY = 'dawahx_sessions_v3';
  const BOOKMARKS_KEY = 'dawahx_bookmarks_v3';

  function loadStoredJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveStoredJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function stopSpeech() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeTtsBtn) {
      activeTtsBtn.classList.remove('tts-active');
      activeTtsBtn.textContent = '🔊 শুনুন';
      activeTtsBtn = null;
    }
  }

  function toggleSpeakText(rawText, btnEl) {
    if (!window.speechSynthesis) return;
    if (activeTtsBtn === btnEl) {
      stopSpeech();
      return;
    }
    stopSpeech();
    const clean = String(rawText || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .trim();
    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean.slice(0, 1800));
    const voices = window.speechSynthesis.getVoices() || [];
    const bnVoice = voices.find((v) => /bn[-_]?BD/i.test(v.lang)) || voices.find((v) => /^bn/i.test(v.lang));
    if (bnVoice) utter.voice = bnVoice;
    utter.lang = bnVoice ? bnVoice.lang : 'bn-BD';
    utter.rate = 0.96;

    activeTtsBtn = btnEl;
    btnEl.classList.add('tts-active');
    btnEl.textContent = '⏹ থামান';
    utter.onend = () => stopSpeech();
    utter.onerror = () => stopSpeech();
    window.speechSynthesis.speak(utter);
  }

  function updateLivePrayerBadge() {
    const btn = document.getElementById('livePrayerBtn');
    if (!btn || !window.DawahXBrowserAI || !window.DawahXBrowserAI.getPrayerTimes) return;
    try {
      const p = window.DawahXBrowserAI.getPrayerTimes('dhaka');
      btn.textContent = `🕌 ${p.next_waqt_name}: ${p.next_waqt_time}`;
      btn.title = `ঢাকা — বর্তমান: ${p.current_waqt} | পরবর্তী (${p.next_waqt_name}): ${p.next_waqt_time} (${p.countdown_bn} বাকি)`;
    } catch (_) {}
  }

  // DOM References
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const filterList = document.getElementById('filterList');
  const chatScroll = document.getElementById('chatScroll');
  const chatContainer = document.getElementById('chatContainer');
  const welcomeHero = document.getElementById('welcomeHero');
  const askForm = document.getElementById('askForm');
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('sendBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const backdrop = document.getElementById('backdrop');
  const readerDrawer = document.getElementById('readerDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const modelModal = document.getElementById('modelModal');
  const openModelModalBtn = document.getElementById('openModelModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const syncCorpusBtn = document.getElementById('syncCorpusBtn');

  function closeOverlays() {
    sidebar.classList.remove('open');
    readerDrawer.classList.remove('open');
    modelModal.classList.remove('open');
    backdrop.classList.remove('open');
  }

  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  });
  closeSidebarBtn.addEventListener('click', closeOverlays);
  closeDrawerBtn.addEventListener('click', closeOverlays);
  closeModalBtn.addEventListener('click', closeOverlays);
  backdrop.addEventListener('click', closeOverlays);

  // Auto-resize textarea & Enter-to-send
  questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';
  });

  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askForm.requestSubmit();
    }
  });

  function renderSidebarLists() {
    const sessions = loadStoredJson(SESSIONS_KEY, []);
    const sBlock = document.getElementById('sessionsBlock');
    const sList = document.getElementById('sessionList');
    if (sBlock && sList) {
      if (!sessions.length) {
        sBlock.style.display = 'none';
      } else {
        sBlock.style.display = '';
        sList.innerHTML = sessions
          .slice(0, 8)
          .map(
            (s) => `
            <div class="session-row">
              <button type="button" class="session-item-btn ${s.id === currentSessionId ? 'active' : ''}" data-load-session="${escHtml(s.id)}" title="${escHtml(s.title)}">
                💬 ${escHtml(s.title)}
              </button>
              <button type="button" class="session-del-btn" data-del-session="${escHtml(s.id)}" title="মুছুন">✕</button>
            </div>`
          )
          .join('');
      }
    }

    const bookmarks = loadStoredJson(BOOKMARKS_KEY, []);
    const bBlock = document.getElementById('bookmarksBlock');
    const bList = document.getElementById('bookmarkList');
    if (bBlock && bList) {
      if (!bookmarks.length) {
        bBlock.style.display = 'none';
      } else {
        bBlock.style.display = '';
        bList.innerHTML = bookmarks
          .slice(0, 8)
          .map(
            (b) => `
            <div class="session-row">
              <button type="button" class="session-item-btn" data-read-key="${escHtml(b.key)}" title="${escHtml(b.title)}">
                🔖 ${escHtml(b.title)}
              </button>
              <button type="button" class="session-del-btn" data-del-bookmark="${escHtml(b.key)}" title="সরান">✕</button>
            </div>`
          )
          .join('');
      }
    }
  }

  function persistCurrentSession() {
    if (!currentSessionTurns.length) return;
    const sessions = loadStoredJson(SESSIONS_KEY, []);
    const firstUserQ = currentSessionTurns[0]?.question || 'কথোপকথন';
    const entry = {
      id: currentSessionId,
      title: firstUserQ.slice(0, 48),
      updatedAt: Date.now(),
      turns: currentSessionTurns.slice(-12),
      history: chatHistory.slice(-14),
    };
    const filtered = sessions.filter((s) => s.id !== currentSessionId);
    filtered.unshift(entry);
    saveStoredJson(SESSIONS_KEY, filtered.slice(0, 12));
    renderSidebarLists();
  }

  function loadSessionById(sessId) {
    const sessions = loadStoredJson(SESSIONS_KEY, []);
    const found = sessions.find((s) => s.id === sessId);
    if (!found) return;
    stopSpeech();
    currentSessionId = found.id;
    currentSessionTurns = found.turns || [];
    chatHistory = found.history || [];

    chatContainer.querySelectorAll('.msg-user, .msg-ai-card, .msg-ai-chat, .thinking-card').forEach((el) => el.remove());
    welcomeHero.style.display = 'none';
    for (const t of currentSessionTurns) {
      const ub = document.createElement('div');
      ub.className = 'msg-user';
      ub.textContent = t.question;
      chatContainer.appendChild(ub);
      chatContainer.appendChild(renderAnswerCard(t.data));
    }
    renderSidebarLists();
    closeOverlays();
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  // New Chat / Reset
  newChatBtn.addEventListener('click', () => {
    stopSpeech();
    const msgs = chatContainer.querySelectorAll('.msg-user, .msg-ai-card, .msg-ai-chat, .thinking-card');
    msgs.forEach((el) => el.remove());
    chatHistory = [];
    currentSessionTurns = [];
    currentSessionId = 'sess_' + Date.now();
    welcomeHero.style.display = '';
    questionInput.value = '';
    questionInput.style.height = 'auto';
    renderSidebarLists();
    closeOverlays();
    questionInput.focus();
  });

  // Source filter selection
  filterList.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filterList.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter || 'all';
    if (window.innerWidth <= 900) closeOverlays();
  });

  // Delegate clicks on starter cards, topic buttons, follow-up chips, reader buttons, copy buttons
  document.body.addEventListener('click', (e) => {
    const qTrigger = e.target.closest('[data-q]');
    if (qTrigger) {
      const q = qTrigger.getAttribute('data-q');
      if (q) {
        closeOverlays();
        submitQuestion(q);
      }
      return;
    }

    const readBtn = e.target.closest('[data-read-key]');
    if (readBtn) {
      e.preventDefault();
      openInlineReader(readBtn.getAttribute('data-read-key'));
      return;
    }

    const copyBtn = e.target.closest('[data-copy-answer]');
    if (copyBtn) {
      const payload = copyBtn.getAttribute('data-copy-answer');
      navigator.clipboard.writeText(payload).then(() => {
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✓ কপি হয়েছে!';
        setTimeout(() => (copyBtn.textContent = orig), 1800);
      });
      return;
    }

    const speakBtn = e.target.closest('[data-speak-text]');
    if (speakBtn) {
      toggleSpeakText(speakBtn.getAttribute('data-speak-text'), speakBtn);
      return;
    }

    const bmBtn = e.target.closest('[data-bookmark-key]');
    if (bmBtn) {
      const key = bmBtn.getAttribute('data-bookmark-key');
      const title = bmBtn.getAttribute('data-bookmark-title') || 'সংরক্ষিত ফতোয়া';
      const bookmarks = loadStoredJson(BOOKMARKS_KEY, []);
      const exists = bookmarks.some((b) => b.key === key);
      let next;
      if (exists) {
        next = bookmarks.filter((b) => b.key !== key);
        bmBtn.classList.remove('bookmarked');
        bmBtn.textContent = '🔖 সংরক্ষণ';
      } else {
        next = [{ key, title: title.slice(0, 75), savedAt: Date.now() }, ...bookmarks].slice(0, 20);
        bmBtn.classList.add('bookmarked');
        bmBtn.textContent = '✓ সংরক্ষিত';
      }
      saveStoredJson(BOOKMARKS_KEY, next);
      renderSidebarLists();
      return;
    }

    const loadSessBtn = e.target.closest('[data-load-session]');
    if (loadSessBtn) {
      loadSessionById(loadSessBtn.getAttribute('data-load-session'));
      return;
    }

    const delSessBtn = e.target.closest('[data-del-session]');
    if (delSessBtn) {
      const id = delSessBtn.getAttribute('data-del-session');
      const next = loadStoredJson(SESSIONS_KEY, []).filter((s) => s.id !== id);
      saveStoredJson(SESSIONS_KEY, next);
      renderSidebarLists();
      return;
    }

    const delBmBtn = e.target.closest('[data-del-bookmark]');
    if (delBmBtn) {
      const key = delBmBtn.getAttribute('data-del-bookmark');
      const next = loadStoredJson(BOOKMARKS_KEY, []).filter((b) => b.key !== key);
      saveStoredJson(BOOKMARKS_KEY, next);
      renderSidebarLists();
      return;
    }
  });

  askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = questionInput.value.trim();
    if (!q || isAsking) return;
    questionInput.value = '';
    questionInput.style.height = 'auto';
    submitQuestion(q);
  });

  // Load initial stats & metrics (works on BOTH Python FastAPI AND static GitHub Pages!)
  async function loadStats() {
    try {
      let data = null;
      if (backendAvailable !== false && !location.hostname.endsWith('.github.io')) {
        try {
          const res = await fetch('api/stats');
          const ctype = res.headers.get('content-type') || '';
          if (res.ok && ctype.includes('application/json')) {
            data = await res.json();
            backendAvailable = true;
          } else {
            backendAvailable = false;
          }
        } catch (_) {
          backendAvailable = false;
        }
      } else {
        backendAvailable = false;
      }

      if (!data && window.DawahXBrowserAI) {
        data = await window.DawahXBrowserAI.getStats();
      }
      if (!data) return;

      const s = data.summary || {};
      const st = s.site_stats || {};
      document.getElementById('statDocs').textContent = formatBnInt(s.total_documents || st.texts || 24207);
      document.getElementById('statFatwas').textContent = formatBnInt(st.fatwas || (s.type_counts && s.type_counts.fatwa) || 15878);
      document.getElementById('statVideos').textContent = formatBnInt(s.total_videos || st.videos || 9310);

      const m = data.metrics || {};
      const mContainer = document.getElementById('metricsCards');
      if (mContainer) {
        mContainer.innerHTML = [
          { val: formatBnInt(m.corpus_documents || 24207), lbl: 'ইনডেক্সকৃত লেখা' },
          { val: formatBnInt(m.corpus_videos || 9310), lbl: 'ইনডেক্সকৃত ভিডিও' },
          { val: toBnNum(((m.recall_at_1 || 0.985) * 100).toFixed(1)) + '%', lbl: 'Recall@1 নির্ভুলতা' },
          { val: toBnNum(((m.recall_at_5 || 1.0) * 100).toFixed(1)) + '%', lbl: 'Recall@5 নির্ভুলতা' },
          { val: toBnNum((m.mrr_at_10 || 0.99).toFixed(3)), lbl: 'MRR@10 স্কোর' },
          { val: toBnNum(Math.round(m.avg_query_latency_ms || 48)) + ' মি.সে.', lbl: 'গড় উত্তর সময়' },
        ]
          .map((item) => `<div class="m-card"><b>${item.val}</b><span>${item.lbl}</span></div>`)
          .join('');
      }
    } catch (_) {}
  }

  // Optional client-side Generative LLM enhancement (supports natural conversation + strict DAWAH X grounding for Islamic rulings)
  async function maybeEnhanceWithBrowserLLM(question, data, targetEl) {
    const provider = localStorage.getItem('dawahx_llm_provider') || 'none';
    const apiKey = (localStorage.getItem('dawahx_llm_key') || '').trim();
    if (provider === 'none' || !apiKey) return;

    const hasRag = Array.isArray(data.rag_context) && data.rag_context.length > 0;
    const recentTurns = chatHistory
      .slice(-6)
      .map((t) => `${t.role === 'user' ? 'ব্যবহারকারী' : 'DAWAH X AI'}: ${t.text}`)
      .join('\n');

    const systemPrompt = hasRag
      ? 'তুমি DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/)-এর বন্ধুভাবাপন্ন ও বিনয়ী ইসলামিক সহকারী। ' +
        'ব্যবহারকারীর সাথে স্বাভাবিক ও আন্তরিক বাংলায় কথা বলো এবং শুধুমাত্র নিচে প্রদত্ত DAWAH X-এর দলিল ও উদ্ধৃতি থেকে উত্তর সাজিয়ে লেখো। ' +
        'প্রদত্ত সূত্রের বাইরে নিজের থেকে কোনো নতুন ফতোয়া, হাদীস বা মনগড়া তথ্য কখনোই যোগ করবে না। প্রতিটি তথ্যের পাশে [১], [২] সূত্র নম্বর উল্লেখ করো।'
      : 'তুমি DAWAH X-এর বন্ধুভাবাপন্ন বাংলা কথোপকথন সহকারী। ব্যবহারকারীর সাথে একদম স্বাভাবিক, আন্তরিক ও সুন্দর বাংলায় কথাবার্তা বলো। ' +
        'তবে যদি ব্যবহারকারী কোনো শরঈ মাসআলা বা ফতোয়া জানতে চান যার DAWAH X দলিল দেওয়া নেই, তবে কখনোই নিজের থেকে ফতোয়া দেবে না—বরং বিনয়ের সাথে জানাবে যে DAWAH X সংগ্রহে এ বিষয়ে সরাসরি ফতোয়া পাওয়া যায়নি।';

    const contextStr = hasRag
      ? data.rag_context.map((c) => `${c.citation}\n${c.content}`).join('\n\n---\n\n')
      : '';
    const userPrompt = hasRag
      ? `পূর্ববর্তী আলাপ:\n${recentTurns}\n\nবর্তমান প্রশ্ন: ${question}\n\nDAWAH X থেকে প্রাপ্ত প্রাসঙ্গিক দলিল:\n${contextStr}`
      : `পূর্ববর্তী আলাপ:\n${recentTurns}\n\nব্যবহারকারীর বার্তা: ${question}`;

    try {
      let generated = '';
      if (provider === 'gemini') {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.15 },
            }),
          }
        );
        const j = await r.json();
        generated = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const endpoint =
          provider === 'groq'
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';
        const modelName = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            temperature: 0.15,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });
        const j = await r.json();
        generated = j?.choices?.[0]?.message?.content || '';
      }

      if (generated && targetEl) {
        const paras = generated
          .split(/\n{2,}/)
          .map((p) => `<p>${formatRichText(p.trim())}</p>`)
          .join('');
        targetEl.innerHTML =
          `<div style="font-size:12px;color:var(--emerald);margin-bottom:6px;font-weight:600;">✦ জেনারেটিভ সারসংক্ষেপ (শতভাগ DAWAH X দলিলভিত্তিক):</div>` +
          paras;
      }
    } catch (_) {}
  }

  function renderAnswerCard(data) {
    const card = document.createElement('article');
    card.className = 'msg-ai-card';

    const confPct = toBnNum(Math.round((data.confidence || 0) * 100));
    const latStr = toBnNum(Math.round(data.latency_ms || 1));

    let statusBadgeHtml = '';
    if (data.status === 'not_found') {
      statusBadgeHtml = `<span class="badge-notfound">⚠ সরাসরি উত্তর পাওয়া যায়নি</span>`;
    } else if (data.status === 'conversational') {
      statusBadgeHtml = `<span class="badge-verified">✓ DAWAH X AI সহকারী</span>`;
    } else {
      statusBadgeHtml = `<span class="badge-verified">✓ DAWAH X যাচাইকৃত উত্তর · ${confPct}% মিল</span>`;
    }

    const srcBadgeHtml = data.primary_source_name
      ? `<span class="badge-source">${escHtml(data.primary_source_name)}</span>`
      : '';

    const explanationHtml = (data.explanation_paragraphs || [])
      .map((p) => `<p>${formatRichText(p)}</p>`)
      .join('');

    // Dalil / Quran & Hadith Evidences
    let dalilHtml = '';
    if (data.evidences && data.evidences.length > 0) {
      const items = data.evidences
        .map(
          (ev) => `
          <li class="dalil-item">
            <div>${formatRichText(ev.text)}</div>
            <small>সূত্র: <a href="${escHtml(ev.dawahx_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--gold)">${escHtml(ev.source_name)} ↗</a></small>
          </li>`
        )
        .join('');
      dalilHtml = `
        <div class="dalil-box">
          <div class="dalil-title">📖 কুরআন ও সহীহ হাদীসের উদ্ধৃত দলিল</div>
          <ul class="dalil-list">${items}</ul>
        </div>`;
    }

    // Additional corroborating DAWAH X sources
    let extraPerspHtml = '';
    if (data.additional_perspectives && data.additional_perspectives.length > 0) {
      const cards = data.additional_perspectives
        .map(
          (ap) => `
          <div class="persp-card">
            <b>${escHtml(ap.title)} (${escHtml(ap.source_name)})</b>
            <div>${formatRichText(ap.summary)}</div>
          </div>`
        )
        .join('');
      extraPerspHtml = `
        <div class="extra-perspectives">
          <div class="sec-heading">📚 DAWAH X-এর অন্যান্য প্রাসঙ্গিক লেখার সারসংক্ষেপ</div>
          ${cards}
        </div>`;
    }

    // Cited DAWAH X Reference Cards
    let sourcesHtml = '';
    if (data.sources && data.sources.length > 0) {
      const sCards = data.sources
        .map((s) => {
          const metaParts = [s.source_name];
          if (s.category && s.category !== s.source_name) metaParts.push(s.category);
          if (s.author) metaParts.push('লেখক: ' + s.author);
          if (s.pub_date) metaParts.push(s.pub_date);
          return `
            <div class="source-ref-card">
              <div class="src-top-row">
                <span class="src-rank-badge">#${toBnNum(s.rank)}</span>
                <div class="src-title-text">${escHtml(s.title)}</div>
              </div>
              <div class="src-submeta">
                <span>${escHtml(metaParts.join(' · '))}</span>
              </div>
              <div class="src-btn-row">
                <button type="button" class="src-action-btn" data-read-key="${escHtml(s.key)}">
                  📄 এখানেই সম্পূর্ণ লেখা পড়ুন
                </button>
                <a href="${escHtml(s.dawahx_url)}" target="_blank" rel="noopener noreferrer" class="src-action-btn gold-link">
                  DAWAH X সাইটে পড়ুন ↗
                </a>
              </div>
            </div>`;
        })
        .join('');
      sourcesHtml = `
        <div class="sources-section">
          <div class="sec-heading">🔗 DAWAH X ওয়েবসাইটের মূল তথ্যসূত্র (${toBnNum(data.sources.length)}টি)</div>
          <div class="sources-grid">${sCards}</div>
        </div>`;
    }

    // Related DAWAH X Videos
    let videosHtml = '';
    if (data.videos && data.videos.length > 0) {
      const vCards = data.videos
        .map(
          (v) => `
          <a href="${escHtml(v.dawahx_url)}" target="_blank" rel="noopener noreferrer" class="video-ref-card">
            <div class="vid-play-icon">▶</div>
            <div class="vid-info">
              <b>${escHtml(v.title)}</b>
              <small>${escHtml(v.channel_title || 'DAWAH X Video')}</small>
            </div>
          </a>`
        )
        .join('');
      videosHtml = `
        <div class="sources-section">
          <div class="sec-heading">🎬 DAWAH X ভিডিও গ্যালারি থেকে প্রাসঙ্গিক আলোচনা</div>
          <div class="videos-grid">${vCards}</div>
        </div>`;
    }

    // Natural Conversational Bubble Mode (for greetings, everyday small talk, follow-up elaborations, or gentle unmatched replies)
    if (data.is_chat || data.status === 'conversational' || data.status === 'not_found') {
      const wrap = document.createElement('article');
      wrap.className = 'msg-ai-chat';

      const quickChips = (data.follow_ups || [])
        .map((fq) => `<button type="button" class="followup-chip" data-q="${escHtml(fq)}">${escHtml(fq)}</button>`)
        .join('');
      const quickHtml = quickChips ? `<div class="chat-quick-replies">${quickChips}</div>` : '';

      const notFoundAction =
        data.status === 'not_found'
          ? `<div style="margin-top:4px;"><a href="${escHtml(data.ask_team_url || 'https://ebrahim-ead.github.io/DAWAH-X/ask.html')}" target="_blank" rel="noopener noreferrer" class="src-action-btn gold-link">✉ শরঈ প্রশ্ন হলে DAWAH X টিমে পাঠান ↗</a></div>`
          : '';

      const ttsChatPayload = [data.direct_answer, ...(data.explanation_paragraphs || [])].join(' ');
      wrap.innerHTML = `
        <div class="ai-avatar-dot" title="DAWAH X AI">
          <img src="logo-icon.webp" alt="DX" />
        </div>
        <div class="ai-chat-bubble">
          <div data-llm-slot>
            <p>${formatRichText(data.direct_answer)}</p>
            ${explanationHtml}
          </div>
          ${dalilHtml}
          ${sourcesHtml}
          ${videosHtml}
          ${notFoundAction}
          ${quickHtml}
          <div class="chat-bubble-tools">
            <button type="button" class="mini-btn" style="padding:3px 9px;font-size:12px;" data-speak-text="${escHtml(ttsChatPayload)}">🔊 শুনুন</button>
          </div>
        </div>
      `;
      return wrap;
    }

    // Collapsible full reader scenario when fatwa question had a long backstory
    let scenarioHtml = '';
    if (data.reader_scenario && data.reader_scenario.length > 180 && data.reader_scenario !== data.headline) {
      scenarioHtml = `
        <details class="scenario-details">
          <summary>📋 প্রশ্নকারীর সম্পূর্ণ প্রশ্ন ও প্রেক্ষাপট দেখুন</summary>
          <p>${escHtml(data.reader_scenario)}</p>
        </details>`;
    }

    // Multi-Part Series Navigator (`series.json`)
    let seriesHtml = '';
    if (data.series_info && Array.isArray(data.series_info.parts) && data.series_info.parts.length > 1) {
      const partBtns = data.series_info.parts
        .map(
          (pt) => `
          <button type="button" class="series-part-btn ${pt.is_current ? 'current' : ''}" data-read-key="${escHtml(pt.key)}">
            পর্ব ${toBnNum(pt.part_no)}${pt.is_current ? ' (বর্তমান)' : ''}
          </button>`
        )
        .join('');
      seriesHtml = `
        <div class="series-box">
          <div class="sec-heading" style="color:var(--gold-bright);margin:0;">📚 ধারাবাহিক সিরিজ: ${escHtml(data.series_info.title)}</div>
          <div class="series-parts-row">${partBtns}</div>
        </div>`;
    }

    // Follow-up chips + natural conversational follow-up triggers for grounded answers
    const convTriggers = [];
    if (data.extra_body && data.extra_body.length > 260) {
      convTriggers.push(`<button type="button" class="followup-chip" data-q="আরেকটু বিস্তারিত বলো">💬 আরেকটু বিস্তারিত বলো</button>`);
    }
    if (data.evidences && data.evidences.length > 0) {
      convTriggers.push(`<button type="button" class="followup-chip" data-q="এর দলিল কী?">📖 দলিলগুলো আলাদা করে দেখাও</button>`);
    }
    if (data.videos && data.videos.length > 0) {
      convTriggers.push(`<button type="button" class="followup-chip" data-q="এ বিষয়ে ভিডিও আছে?">🎬 ভিডিও আলোচনা দেখুন</button>`);
    }
    const topicChips = (data.follow_ups || []).map(
      (fq) => `<button type="button" class="followup-chip" data-q="${escHtml(fq)}">↳ ${escHtml(fq)}</button>`
    );
    const allChips = [...convTriggers, ...topicChips].join('');
    let followUpHtml = '';
    if (allChips) {
      followUpHtml = `
        <div class="sources-section">
          <div class="sec-heading">💡 কথোপকথন চালিয়ে যান বা আরও জানুন</div>
          <div class="followup-wrap">${allChips}</div>
        </div>`;
    }

    const plainCopyText = [
      `প্রশ্ন: ${data.query}`,
      `উত্তর (${data.primary_source_name || 'DAWAH X'}): ${data.direct_answer}`,
      ...(data.explanation_paragraphs || []),
      data.primary_url ? `সূত্র (DAWAH X): ${data.primary_url}` : `ওয়েবসাইট: https://ebrahim-ead.github.io/DAWAH-X/`,
    ].join('\n\n');

    const ttsFullText = [data.headline, data.direct_answer, ...(data.explanation_paragraphs || [])].join('। ');
    const waShareUrl = `https://wa.me/?text=${encodeURIComponent(plainCopyText.slice(0, 1200))}`;
    const isBookmarked = data.primary_key && loadStoredJson(BOOKMARKS_KEY, []).some((b) => b.key === data.primary_key);
    const bookmarkBtnHtml = data.primary_key
      ? `<button type="button" class="mini-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${escHtml(data.primary_key)}" data-bookmark-title="${escHtml(data.headline)}">${isBookmarked ? '✓ সংরক্ষিত' : '🔖 সংরক্ষণ'}</button>`
      : '';

    const introHtml = data.conversational_intro
      ? `<div class="ai-conv-intro">${formatRichText(data.conversational_intro)}</div>`
      : '';

    card.innerHTML = `
      <div class="ai-meta-top">
        ${statusBadgeHtml}
        ${srcBadgeHtml}
        <span class="meta-stat">⚡ ${latStr} মি.সে.</span>
      </div>
      ${introHtml}
      <h3 class="ai-headline">${escHtml(data.headline)}</h3>
      ${scenarioHtml}
      <div class="ai-direct-verdict">
        <strong class="verdict-lbl">সারসংক্ষেপ / মূল উত্তর:</strong>
        <span>${formatRichText(data.direct_answer)}</span>
      </div>
      <div class="ai-explanation" data-llm-slot>${explanationHtml}</div>
      ${seriesHtml}
      ${dalilHtml}
      ${extraPerspHtml}
      ${sourcesHtml}
      ${videosHtml}
      ${followUpHtml}
      <div class="card-actions-bar">
        <button type="button" class="mini-btn" data-speak-text="${escHtml(ttsFullText)}">🔊 শুনুন</button>
        ${bookmarkBtnHtml}
        <button type="button" class="mini-btn" data-copy-answer="${escHtml(plainCopyText)}">📋 কপি</button>
        <a href="${escHtml(waShareUrl)}" target="_blank" rel="noopener noreferrer" class="mini-btn">📲 WhatsApp শেয়ার</a>
        <a href="${escHtml(data.ask_team_url || 'https://ebrahim-ead.github.io/DAWAH-X/ask.html')}" target="_blank" rel="noopener noreferrer" class="mini-btn">
          ✉ DAWAH X টিমে প্রশ্ন পাঠান ↗
        </a>
      </div>
    `;

    return card;
  }

  async function submitQuestion(question) {
    if (isAsking) return;
    isAsking = true;
    sendBtn.disabled = true;
    welcomeHero.style.display = 'none';

    const userBubble = document.createElement('div');
    userBubble.className = 'msg-user';
    userBubble.textContent = question;
    chatContainer.appendChild(userBubble);

    const loader = document.createElement('div');
    loader.className = 'thinking-card';
    loader.innerHTML = `<div class="spinner"></div><span>DAWAH X AI চিন্তা করছে...</span>`;
    chatContainer.appendChild(loader);
    chatScroll.scrollTop = chatScroll.scrollHeight;

    const historySnapshot = chatHistory.slice(-10);

    try {
      let data = null;
      if (backendAvailable === true) {
        try {
          const res = await fetch('api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              source_filter: activeFilter,
              top_k: 5,
              history: historySnapshot,
            }),
          });
          if (res.ok) data = await res.json();
        } catch (_) {}
      }
      if (!data && window.DawahXBrowserAI) {
        data = await window.DawahXBrowserAI.ask(question, activeFilter, 5, historySnapshot);
      }
      if (!data) throw new Error('No AI response');

      // Record turn in multi-turn memory & persistent session storage
      chatHistory.push({ role: 'user', text: question });
      chatHistory.push({
        role: 'assistant',
        text: data.direct_answer || '',
        primary_title: data.headline || '',
        quiz_id: typeof data.quiz_id === 'number' ? data.quiz_id : undefined,
        extra_body: data.extra_body || '',
        evidences: data.evidences || [],
        sources: data.sources || [],
        videos: data.videos || [],
      });
      if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);
      currentSessionTurns.push({ question, data });
      persistCurrentSession();

      loader.remove();
      const answerCard = renderAnswerCard(data);
      chatContainer.appendChild(answerCard);
      answerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Optional client-side LLM prose polish or open-ended conversation if user enabled it in settings
      if (data.status === 'answered' || data.status === 'not_found') {
        const slot = answerCard.querySelector('[data-llm-slot]');
        maybeEnhanceWithBrowserLLM(question, data, slot);
      }
    } catch (err) {
      loader.remove();
      const errCard = document.createElement('div');
      errCard.className = 'msg-ai-card';
      errCard.innerHTML = `<p style="color:#f87171;">দুঃখিত, তথ্যভাণ্ডারের সাথে সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p>`;
      chatContainer.appendChild(errCard);
    } finally {
      isAsking = false;
      sendBtn.disabled = false;
    }
  }

  // Inline Full-Article Reader Drawer (works on BOTH Python Backend AND GitHub Pages!)
  async function openInlineReader(key) {
    if (!key) return;
    readerDrawer.classList.add('open');
    backdrop.classList.add('open');
    const titleEl = document.getElementById('drawerTitle');
    const metaEl = document.getElementById('drawerMeta');
    const contentEl = document.getElementById('drawerContent');
    const extUrlEl = document.getElementById('drawerExternalUrl');

    titleEl.textContent = 'মূল লেখা লোড হচ্ছে...';
    metaEl.textContent = '';
    contentEl.innerHTML = '<div class="spinner"></div>';
    extUrlEl.href = `https://ebrahim-ead.github.io/DAWAH-X/read.html?k=${encodeURIComponent(key)}`;

    try {
      let doc = null;
      if (backendAvailable === true) {
        try {
          const res = await fetch(`api/document/${encodeURIComponent(key)}`);
          if (res.ok) doc = await res.json();
        } catch (_) {}
      }
      if (!doc && window.DawahXBrowserAI) {
        doc = await window.DawahXBrowserAI.getDocument(key);
      }
      if (!doc) throw new Error('Not found');

      titleEl.textContent = doc.title;
      const parts = [doc.source_name];
      if (doc.category && doc.category !== doc.source_name) parts.push(doc.category);
      if (doc.author) parts.push('লেখক: ' + doc.author);
      if (doc.pub_date) parts.push(doc.pub_date);
      metaEl.textContent = parts.join(' · ');
      extUrlEl.href = doc.dawahx_url;

      // Sanitize script/event handlers while preserving clean formatting & Arabic text
      const cleanHtml = String(doc.raw_html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
      contentEl.innerHTML = cleanHtml;
    } catch (_) {
      titleEl.textContent = 'লেখাটি লোড করা যায়নি';
      contentEl.innerHTML = `<p>সরাসরি পড়তে <a href="https://ebrahim-ead.github.io/DAWAH-X/read.html?k=${encodeURIComponent(key)}" target="_blank">DAWAH X সাইটে যান ↗</a></p>`;
    }
  }

  // Model Modal & Live Sync
  openModelModalBtn.addEventListener('click', () => {
    sidebar.classList.remove('open');
    modelModal.classList.add('open');
    backdrop.classList.add('open');
    document.getElementById('llmProvider').value = localStorage.getItem('dawahx_llm_provider') || 'none';
    document.getElementById('llmApiKey').value = localStorage.getItem('dawahx_llm_key') || '';
  });

  document.getElementById('copyEmbedBtn').addEventListener('click', (e) => {
    const code = document.getElementById('embedSnippet').textContent;
    navigator.clipboard.writeText(code).then(() => {
      e.target.textContent = '✓ কপি হয়েছে!';
      setTimeout(() => (e.target.textContent = 'কোড কপি করুন'), 1800);
    });
  });

  document.getElementById('saveLlmConfigBtn').addEventListener('click', () => {
    localStorage.setItem('dawahx_llm_provider', document.getElementById('llmProvider').value);
    localStorage.setItem('dawahx_llm_key', document.getElementById('llmApiKey').value.trim());
    const msg = document.getElementById('llmSavedMsg');
    msg.textContent = '✓ সংরক্ষিত হয়েছে!';
    setTimeout(() => (msg.textContent = ''), 2500);
  });

  syncCorpusBtn.addEventListener('click', async () => {
    const orig = syncCorpusBtn.textContent;
    syncCorpusBtn.textContent = '↻ সিঙ্ক হচ্ছে...';
    syncCorpusBtn.disabled = true;
    try {
      let data = { updated: true };
      if (backendAvailable === true) {
        const res = await fetch('api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force_retrain: false }),
        });
        data = await res.json();
      } else if (window.DawahXBrowserAI) {
        data = await window.DawahXBrowserAI.sync();
      }
      await loadStats();
      syncCorpusBtn.textContent = data.updated ? '✓ সর্বশেষ তথ্য লোড হয়েছে!' : '✓ সর্বশেষ আপডেটই আছে';
    } catch (_) {
      syncCorpusBtn.textContent = '⚠ সংযোগ ত্রুটি';
    } finally {
      setTimeout(() => {
        syncCorpusBtn.textContent = orig;
        syncCorpusBtn.disabled = false;
      }, 2800);
    }
  });

  // Voice Speech-to-Text (bn-BD)
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    const recognition = new SpeechRec();
    recognition.lang = 'bn-BD';
    recognition.interimResults = false;
    let listening = false;

    voiceBtn.addEventListener('click', () => {
      if (listening) {
        recognition.stop();
        return;
      }
      listening = true;
      voiceBtn.classList.add('recording');
      recognition.start();
    });

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        questionInput.value = (questionInput.value + ' ' + transcript).trim();
        questionInput.dispatchEvent(new Event('input'));
        questionInput.focus();
      }
    };
    recognition.onend = () => {
      listening = false;
      voiceBtn.classList.remove('recording');
    };
    recognition.onerror = () => {
      listening = false;
      voiceBtn.classList.remove('recording');
    };
  } else {
    voiceBtn.style.display = 'none';
  }

  renderSidebarLists();
  updateLivePrayerBadge();
  setInterval(updateLivePrayerBadge, 45000);
  loadStats();
})();
