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

  // Highlight inline Arabic script in Noto Naskh Arabic, bold markdown **...**, & inline numbered points
  function formatRichText(text) {
    let safe = escHtml(text);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(
      /([\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F\u0670\uFD50-\uFDFF\uFE70-\uFEFF۝﴿﴾().,،؛:«»\-]{3,})/g,
      '<span class="ar-inline">$1</span>'
    );
    safe = safe.replace(/(?<=[।?!:])\s+(\([০-৯ক-ঘ]+\)|[০-৯]+\.)\s+/g, '<br><strong>$1</strong> ');
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
  const CITY_KEY = 'dawahx_user_city_v4';
  const THEME_KEY = 'dawahx_theme_v4';
  const FONTSIZE_KEY = 'dawahx_fontsize_v4';
  const CF_WORKER_KEY = 'dawahx_cf_worker_url_v1';
  const DEFAULT_CF_WORKER_URL = String(
    window.DAWAHX_WORKER_URL || 'https://ead.ead123628.workers.dev'
  )
    .trim()
    .replace(/\/+$/, '');

  // Support 1-click `?worker=https://...` auto-linking
  try {
    const paramWorker = new URLSearchParams(location.search).get('worker');
    if (paramWorker && /^https?:\/\//i.test(paramWorker.trim())) {
      localStorage.setItem(CF_WORKER_KEY, paramWorker.trim().replace(/\/+$/, ''));
    }
  } catch (_) {}

  let cfAiAvailable = false;
  let cfAiEndpointBase = '';
  let cfAiModelName = 'Llama 3.3 70B';

  let selectedCityId = localStorage.getItem(CITY_KEY) || 'dhaka';
  let activeQuoteMeta = { title: '', source: '', url: '', theme: 'dark', blob: null };
  let deferredInstallPrompt = null;

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
    if (!window.DawahXBrowserAI || !window.DawahXBrowserAI.getPrayerTimes) return;
    try {
      const p = window.DawahXBrowserAI.getPrayerTimes(selectedCityId);
      const label = `🕌 ${p.city} · ${p.next_waqt_name}: ${p.next_waqt_time}`;
      const tip = `${p.city} — বর্তমান: ${p.current_waqt} | পরবর্তী (${p.next_waqt_name}): ${p.next_waqt_time} (${p.countdown_bn} বাকি)`;
      const btn = document.getElementById('livePrayerBtn');
      const mobBtn = document.getElementById('mobilePrayerBtn');
      if (btn) {
        btn.textContent = label;
        btn.title = tip;
      }
      if (mobBtn) {
        mobBtn.textContent = label;
        mobBtn.title = tip;
      }
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
  const prayerModal = document.getElementById('prayerModal');
  const quoteCardModal = document.getElementById('quoteCardModal');
  const videoModal = document.getElementById('videoModal');
  const videoModalIframe = document.getElementById('videoModalIframe');
  const openModelModalBtn = document.getElementById('openModelModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const syncCorpusBtn = document.getElementById('syncCorpusBtn');
  const mirasModal = document.getElementById('mirasModal');
  const tasbihModal = document.getElementById('tasbihModal');
  const cmdModal = document.getElementById('cmdModal');
  const suggestDropdown = document.getElementById('suggestDropdown');
  const pubSourceSelect = document.getElementById('pubSourceSelect');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');
  const appShell = document.querySelector('.app-shell');
  const appToast = document.getElementById('appToast');

  let activeSuggestItems = [];
  let activeSuggestIdx = -1;
  let activeReaderDoc = null;
  let activeReaderBaseHtml = '';
  let toastTimer = null;

  function showToast(msg) {
    if (!appToast) return;
    appToast.textContent = msg;
    appToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => appToast.classList.remove('show'), 2200);
  }

  function hideSuggestions() {
    activeSuggestItems = [];
    activeSuggestIdx = -1;
    if (suggestDropdown) {
      suggestDropdown.style.display = 'none';
      suggestDropdown.innerHTML = '';
    }
  }

  function renderSuggestions(items) {
    if (!suggestDropdown || !items.length) {
      hideSuggestions();
      return;
    }
    activeSuggestItems = items;
    activeSuggestIdx = -1;
    suggestDropdown.innerHTML = items
      .map(
        (it, idx) => `
        <button type="button" class="suggest-item" role="option" data-suggest-idx="${idx}">
          <span class="suggest-icon">🔍</span>
          <span>${escHtml(it)}</span>
        </button>`
      )
      .join('');
    suggestDropdown.style.display = 'block';
  }

  function closeOverlays() {
    sidebar.classList.remove('open');
    readerDrawer.classList.remove('open');
    modelModal.classList.remove('open');
    if (prayerModal) prayerModal.classList.remove('open');
    if (quoteCardModal) quoteCardModal.classList.remove('open');
    if (mirasModal) mirasModal.classList.remove('open');
    if (tasbihModal) tasbihModal.classList.remove('open');
    if (cmdModal) cmdModal.classList.remove('open');
    if (videoModal) {
      videoModal.classList.remove('open');
      if (videoModalIframe) videoModalIframe.src = '';
    }
    hideSuggestions();
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

  // Auto-resize textarea, Smart Typeahead & Enter-to-send
  questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';
    const val = questionInput.value.trim();
    if (val.length >= 2 && val.length <= 65 && window.DawahXBrowserAI && window.DawahXBrowserAI.suggest) {
      renderSuggestions(window.DawahXBrowserAI.suggest(val, 5));
    } else {
      hideSuggestions();
    }
  });

  questionInput.addEventListener('keydown', (e) => {
    if (activeSuggestItems.length > 0 && suggestDropdown && suggestDropdown.style.display !== 'none') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestIdx = (activeSuggestIdx + 1) % activeSuggestItems.length;
        suggestDropdown.querySelectorAll('.suggest-item').forEach((el, i) => el.classList.toggle('active', i === activeSuggestIdx));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestIdx = (activeSuggestIdx - 1 + activeSuggestItems.length) % activeSuggestItems.length;
        suggestDropdown.querySelectorAll('.suggest-item').forEach((el, i) => el.classList.toggle('active', i === activeSuggestIdx));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSuggestions();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && activeSuggestIdx >= 0) {
        e.preventDefault();
        const chosen = activeSuggestItems[activeSuggestIdx];
        hideSuggestions();
        questionInput.value = '';
        questionInput.style.height = 'auto';
        submitQuestion(chosen);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      hideSuggestions();
      askForm.requestSubmit();
    }
  });

  suggestDropdown?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest-idx]');
    if (!btn) return;
    const chosen = activeSuggestItems[Number(btn.getAttribute('data-suggest-idx'))];
    hideSuggestions();
    if (chosen) {
      questionInput.value = '';
      questionInput.style.height = 'auto';
      submitQuestion(chosen);
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

  // Source filter selection (Category buttons + 7-Publication Granular Selector)
  filterList.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filterList.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (pubSourceSelect) pubSourceSelect.value = '';
    activeFilter = btn.dataset.filter || 'all';
    if (window.innerWidth <= 900) closeOverlays();
  });

  pubSourceSelect?.addEventListener('change', () => {
    const val = pubSourceSelect.value;
    if (val) {
      filterList.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      activeFilter = val;
    } else {
      const allBtn = filterList.querySelector('[data-filter="all"]');
      if (allBtn) allBtn.classList.add('active');
      activeFilter = 'all';
    }
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
        showToast('✓ কপি করা হয়েছে!');
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✓ কপি!';
        setTimeout(() => (copyBtn.textContent = orig), 1600);
      });
      return;
    }

    const shareQBtn = e.target.closest('[data-share-q]');
    if (shareQBtn) {
      const qText = shareQBtn.getAttribute('data-share-q') || '';
      const shareUrl = `${location.origin}${location.pathname}?q=${encodeURIComponent(qText)}`;
      if (navigator.share && window.matchMedia('(max-width: 900px)').matches) {
        navigator.share({ title: `DAWAH X AI — ${qText}`, url: shareUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('✓ প্রশ্নের সরাসরি লিংক কপি হয়েছে!');
        });
      }
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

    const closeModalTrigger = e.target.closest('[data-close-modal]');
    if (closeModalTrigger) {
      closeOverlays();
      return;
    }

    const openPrayerTrigger = e.target.closest('[data-open-prayer-modal]');
    if (openPrayerTrigger) {
      openPrayerModal();
      return;
    }

    const openMirasTrigger = e.target.closest('[data-open-miras-modal]');
    if (openMirasTrigger) {
      openMirasModal();
      return;
    }

    const openTasbihTrigger = e.target.closest('[data-open-tasbih-modal]');
    if (openTasbihTrigger) {
      openTasbihModal();
      return;
    }

    const playVidTrigger = e.target.closest('[data-play-video]');
    if (playVidTrigger) {
      e.preventDefault();
      openVideoModal(
        playVidTrigger.getAttribute('data-play-video'),
        playVidTrigger.getAttribute('data-video-title') || 'DAWAH X Video'
      );
      return;
    }

    const quoteBtn = e.target.closest('[data-quote-card]');
    if (quoteBtn) {
      openQuoteCardModal({
        text: quoteBtn.getAttribute('data-quote-card') || '',
        title: quoteBtn.getAttribute('data-quote-title') || '',
        source: quoteBtn.getAttribute('data-quote-source') || 'DAWAH X',
        key: quoteBtn.getAttribute('data-quote-key') || '',
      });
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

  // Cloudflare Workers AI Auto-Discovery + Live Streaming Generative RAG & Conversation
  function updateCfStatusUI() {
    const pill = document.getElementById('headerAiPill');
    const badge = document.getElementById('cfAiStatusBadge');
    if (pill) {
      pill.classList.toggle('cf-live', cfAiAvailable);
      pill.title = cfAiAvailable
        ? `Cloudflare Workers AI সক্রিয় (${cfAiModelName} · Live Streaming)`
        : 'DAWAH X AI ইঞ্জিন';
    }
    if (badge) {
      badge.classList.toggle('live', cfAiAvailable);
      badge.textContent = cfAiAvailable
        ? '🟢 সক্রিয় · Cloudflare AI (Llama 3.3 70B)'
        : '⚪ স্ট্যান্ডঅ্যালোন ব্রাউজার মোড';
    }
  }

  async function detectCloudflareAI(explicitUrl) {
    let candidateBase =
      explicitUrl !== undefined
        ? String(explicitUrl || '').trim().replace(/\/+$/, '')
        : (localStorage.getItem(CF_WORKER_KEY) || DEFAULT_CF_WORKER_URL).trim().replace(/\/+$/, '');

    // Use fast same-origin relative path when already hosted on the Worker origin (skips CORS preflight!)
    if (candidateBase && location.origin === candidateBase) {
      candidateBase = '';
    }

    if (!candidateBase && location.hostname.endsWith('.github.io')) {
      cfAiAvailable = false;
      cfAiEndpointBase = '';
      updateCfStatusUI();
      return false;
    }

    const healthUrl = candidateBase ? `${candidateBase}/api/health` : 'api/health';
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 4500) : null;
    try {
      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined,
      });
      const ctype = res.headers.get('content-type') || '';
      if (res.ok && ctype.includes('application/json')) {
        const info = await res.json();
        if (info && info.ok && info.engine === 'cloudflare-workers-ai') {
          cfAiAvailable = true;
          cfAiEndpointBase = candidateBase;
          cfAiModelName = String(info.primary_model || '').includes('70b') ? 'Llama 3.3 70B' : 'Cloudflare AI';
          updateCfStatusUI();
          return true;
        }
      }
    } catch (_) {
    } finally {
      if (timer) clearTimeout(timer);
    }

    cfAiAvailable = false;
    cfAiEndpointBase = '';
    updateCfStatusUI();
    return false;
  }

  function applyGeneratedAnswerToCard(answerCard, data, generatedText) {
    if (!generatedText) return;
    data.ai_generated = generatedText;
    // Update last assistant history entry & persisted session so follow-ups remember the AI synthesis
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      if (chatHistory[i].role === 'assistant') {
        chatHistory[i].text = generatedText.slice(0, 1100);
        break;
      }
    }
    persistCurrentSession();

    const speakBtn = answerCard?.querySelector('[data-speak-text]');
    if (speakBtn) {
      speakBtn.setAttribute('data-speak-text', `${data.headline ? data.headline + '। ' : ''}${generatedText}`);
    }
    const mainCopyBtn = answerCard?.querySelector('.card-actions-bar [data-copy-answer]');
    if (mainCopyBtn) {
      const srcLine = data.sources?.[0]?.dawahx_url ? `\n\nসূত্র: ${data.sources[0].dawahx_url}` : '';
      mainCopyBtn.setAttribute(
        'data-copy-answer',
        `${data.headline ? data.headline + '\n\n' : ''}${generatedText}${srcLine}`
      );
    }
  }

  async function maybeEnhanceWithBrowserLLM(question, data, targetEl, answerCard, historySnapshot) {
    // Never overwrite deterministic built-in tools (Prayer Times, Hijri Date, Clock, Zakat Math, Masnoon Duas, Quizzes, Recent Articles)!
    if (!targetEl || data.is_deterministic_tool) return;

    const hasRag = Array.isArray(data.rag_context) && data.rag_context.length > 0;
    const isBubble = Boolean(data.is_chat || data.status === 'conversational' || data.status === 'not_found');
    const mode =
      data.status === 'not_found'
        ? 'not_found_islamic'
        : hasRag && !data.is_chat
          ? 'grounded'
          : 'chat';

    // 1) Primary: Cloudflare Workers AI Live Token Streaming (zero API key needed by visitors!)
    if (cfAiAvailable) {
      const aiUrl = cfAiEndpointBase ? `${cfAiEndpointBase}/api/ai` : 'api/ai';
      const fallbackHtml = targetEl.innerHTML;
      let streamBody = null;
      let statusSpan = null;

      if (isBubble) {
        targetEl.innerHTML = `<div class="ai-stream-body" data-stream-body><span class="stream-cursor"></span></div>`;
        streamBody = targetEl.querySelector('[data-stream-body]');
      } else {
        targetEl.innerHTML =
          `<div class="ai-stream-box">` +
          `<div class="ai-stream-head">` +
          `<span data-stream-status>✦ DAWAH X AI ব্যাখ্যা সাজাচ্ছে...</span>` +
          `<small>শতভাগ DAWAH X দলিলভিত্তিক</small>` +
          `</div>` +
          `<div class="ai-stream-body" data-stream-body><span class="stream-cursor"></span></div>` +
          `</div>` +
          (fallbackHtml.trim()
            ? `<details class="verbatim-details"><summary>📜 মূল ফতোয়ার হুবহু অংশ দেখুন</summary>${fallbackHtml}</details>`
            : '');
        streamBody = targetEl.querySelector('[data-stream-body]');
        statusSpan = targetEl.querySelector('[data-stream-status]');
      }

      try {
        const res = await fetch(aiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            mode,
            stream: true,
            headline: data.headline || '',
            primary_verdict: hasRag ? data.direct_answer || '' : '',
            history: (historySnapshot || chatHistory.slice(0, -2)).slice(-8),
            rag_context: hasRag ? data.rag_context.slice(0, 5) : [],
            evidences: Array.isArray(data.evidences) ? data.evidences.slice(0, 4) : [],
          }),
        });

        if (!res.ok || !res.body) throw new Error('Stream unavailable');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = '';
        let fullText = '';
        let rafScheduled = false;

        const flushRender = (doneNow) => {
          rafScheduled = false;
          if (!streamBody) return;
          if (!fullText && !doneNow) return;
          streamBody.innerHTML =
            formatRichText(fullText.trim()) + (doneNow ? '' : '<span class="stream-cursor"></span>');
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });
          const lines = sseBuf.split(/\r?\n/);
          sseBuf = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload);
              if (typeof evt.token === 'string' && evt.token) {
                fullText += evt.token;
                if (!rafScheduled) {
                  rafScheduled = true;
                  requestAnimationFrame(() => flushRender(false));
                }
              }
            } catch (_) {}
          }
        }

        const cleaned = fullText.trim();
        if (cleaned) {
          flushRender(true);
          if (statusSpan) statusSpan.textContent = `✓ DAWAH X AI বিশ্লেষণ · ${cfAiModelName}`;
          applyGeneratedAnswerToCard(answerCard, data, cleaned);
          return;
        }
        targetEl.innerHTML = fallbackHtml;
        return;
      } catch (_) {
        targetEl.innerHTML = fallbackHtml;
      }
    }

    // 2) Secondary Optional Fallback: User-provided Gemini / Groq / OpenAI Key in Browser
    const provider = localStorage.getItem('dawahx_llm_provider') || 'none';
    const apiKey = (localStorage.getItem('dawahx_llm_key') || '').trim();
    if (provider === 'none' || !apiKey) return;

    const recentTurns = (historySnapshot || chatHistory)
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
        if (isBubble) {
          targetEl.innerHTML = `<div class="ai-stream-body">${formatRichText(generated.trim())}</div>`;
        } else {
          const origHtml = targetEl.innerHTML;
          targetEl.innerHTML =
            `<div class="ai-stream-box">` +
            `<div class="ai-stream-head"><span>✦ জেনারেটিভ বিশ্লেষণ (শতভাগ DAWAH X দলিলভিত্তিক)</span></div>` +
            `<div class="ai-stream-body">${formatRichText(generated.trim())}</div>` +
            `</div>` +
            (origHtml.trim()
              ? `<details class="verbatim-details"><summary>📜 মূল ফতোয়ার হুবহু অংশ দেখুন</summary>${origHtml}</details>`
              : '');
        }
        applyGeneratedAnswerToCard(answerCard, data, generated.trim());
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

    const rawExplanationHtml = (data.explanation_paragraphs || [])
      .map((p) => `<p>${formatRichText(p)}</p>`)
      .join('');
    const explanationHtml = data.ai_generated
      ? data.is_chat || data.status === 'conversational' || data.status === 'not_found'
        ? `<div class="ai-stream-body">${formatRichText(data.ai_generated)}</div>`
        : `<div class="ai-stream-box"><div class="ai-stream-head"><span>✓ DAWAH X AI বিশ্লেষণ</span><small>শতভাগ DAWAH X দলিলভিত্তিক</small></div><div class="ai-stream-body">${formatRichText(data.ai_generated)}</div></div>` +
          (rawExplanationHtml
            ? `<details class="verbatim-details"><summary>📜 মূল ফতোয়ার হুবহু অংশ দেখুন</summary>${rawExplanationHtml}</details>`
            : '')
      : rawExplanationHtml;

    // Dalil / Quran & Hadith Evidences
    let dalilHtml = '';
    if (data.evidences && data.evidences.length > 0) {
      const items = data.evidences
        .map(
          (ev) => `
          <li class="dalil-item">
            <div>${formatRichText(ev.text)}</div>
            <div class="dalil-item-head">
              <small>সূত্র: <a href="${escHtml(ev.dawahx_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--gold)">${escHtml(ev.source_name)} ↗</a></small>
              <button type="button" class="dalil-copy-btn" data-copy-answer="${escHtml(ev.text + ' — ' + ev.source_name)}">📋 দলিল কপি</button>
            </div>
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
          <div class="sources-grid ${data.sources.length >= 2 ? 'multi-src' : ''}">${sCards}</div>
        </div>`;
    }

    // Related DAWAH X Videos
    let videosHtml = '';
    if (data.videos && data.videos.length > 0) {
      const vCards = data.videos
        .map(
          (v) => `
          <button type="button" class="video-ref-card" data-play-video="${escHtml(v.video_id || '')}" data-video-title="${escHtml(v.title)}" style="text-align:left;cursor:pointer;width:100%;">
            <div class="vid-play-icon">▶</div>
            <div class="vid-info">
              <b>${escHtml(v.title)}</b>
              <small>${escHtml(v.channel_title || 'DAWAH X Video')}</small>
            </div>
          </button>`
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

      const ttsChatPayload = data.ai_generated || [data.direct_answer, ...(data.explanation_paragraphs || [])].join(' ');
      wrap.innerHTML = `
        <div class="ai-avatar-dot" title="DAWAH X AI">
          <img src="logo-icon.webp" alt="DX" />
        </div>
        <div class="ai-chat-bubble">
          <div data-llm-slot>
            ${data.ai_generated ? explanationHtml : `<p>${formatRichText(data.direct_answer)}</p>${explanationHtml}`}
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

    const quoteSnippet = String(data.direct_answer || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .slice(0, 260);
    const quoteCardBtnHtml = `
      <button type="button" class="mini-btn"
        data-quote-card="${escHtml(quoteSnippet)}"
        data-quote-title="${escHtml(data.headline)}"
        data-quote-source="${escHtml(data.primary_source_name || 'DAWAH X')}"
        data-quote-key="${escHtml(data.primary_key || '')}">
        🖼 ফতোয়া কার্ড
      </button>`;

    // Contextual Smart Built-in Tool CTA (Fara'id Miras, Prayer Times, Digital Tasbih)
    let smartToolHtml = '';
    const qContext = `${data.query || ''} ${data.headline || ''}`;
    if (/(?:সম্পত্তি|মিরাস|ফারায়েয|ফারায়েজ|ওয়ারিশ|উত্তরাধিকার|তেজ্য|ত্যাজ্য)/u.test(qContext)) {
      smartToolHtml = `<button type="button" class="smart-tool-cta" data-open-miras-modal="1">⚖️ কুরআনিক ফারায়েয / মিরাস ক্যালকুলেটরে অংশ হিসাব করুন ➔</button>`;
    } else if (/(?:ওয়াক্ত|সাহরী|সেহরি|ইফতার|ফজরের\s*সময়|নামাজের\s*সময়)/u.test(qContext)) {
      smartToolHtml = `<button type="button" class="smart-tool-cta" data-open-prayer-modal="1">🕌 ২৪ জেলার আজকের নামাজ, সেহরি ও ইফতারের সময়সূচি দেখুন ➔</button>`;
    } else if (/(?:তাসবীহ|যিকির|জিকির|ইস্তিগফার|সুবহানাল্লাহ)/u.test(qContext)) {
      smartToolHtml = `<button type="button" class="smart-tool-cta" data-open-tasbih-modal="1">📿 ডিজিটাল তাসবীহ ও যিকির কাউন্টার খুলুন ➔</button>`;
    }

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
      ${smartToolHtml}
      <div class="ai-explanation" data-llm-slot>${explanationHtml}</div>
      ${seriesHtml}
      ${dalilHtml}
      ${extraPerspHtml}
      ${sourcesHtml}
      ${videosHtml}
      ${followUpHtml}
      <div class="card-actions-bar">
        <button type="button" class="mini-btn" data-speak-text="${escHtml(ttsFullText)}">🔊 শুনুন</button>
        ${quoteCardBtnHtml}
        ${bookmarkBtnHtml}
        <button type="button" class="mini-btn" data-copy-answer="${escHtml(plainCopyText)}">📋 কপি</button>
        <button type="button" class="mini-btn" data-share-q="${escHtml(data.query || data.headline || '')}">🔗 লিংক শেয়ার</button>
        <a href="${escHtml(waShareUrl)}" target="_blank" rel="noopener noreferrer" class="mini-btn">📲 WhatsApp</a>
        <a href="${escHtml(data.ask_team_url || 'https://ebrahim-ead.github.io/DAWAH-X/ask.html')}" target="_blank" rel="noopener noreferrer" class="mini-btn">
          ✉ প্রশ্ন পাঠান ↗
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

      // Stream live generative response via Cloudflare Workers AI (or optional Browser LLM) across ALL modes!
      const slot = answerCard.querySelector('[data-llm-slot]');
      maybeEnhanceWithBrowserLLM(question, data, slot, answerCard, historySnapshot);
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
    const rSearchInput = document.getElementById('readerSearchInput');
    const rMatchBadge = document.getElementById('readerMatchBadge');
    const rReadTime = document.getElementById('readerReadTimeBadge');

    activeReaderDoc = null;
    activeReaderBaseHtml = '';
    if (rSearchInput) rSearchInput.value = '';
    if (rMatchBadge) rMatchBadge.style.display = 'none';
    if (rReadTime) rReadTime.textContent = '';

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

      activeReaderDoc = doc;
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
      activeReaderBaseHtml = cleanHtml;
      contentEl.innerHTML = cleanHtml;

      const wordCount = (contentEl.textContent || '').trim().split(/\s+/).filter(Boolean).length;
      const mins = Math.max(1, Math.round(wordCount / 185));
      if (rReadTime) rReadTime.textContent = `⏱ ~${toBnNum(mins)} মিনিট পাঠ`;
    } catch (_) {
      titleEl.textContent = 'লেখাটি লোড করা যায়নি';
      contentEl.innerHTML = `<p>সরাসরি পড়তে <a href="https://ebrahim-ead.github.io/DAWAH-X/read.html?k=${encodeURIComponent(key)}" target="_blank">DAWAH X সাইটে যান ↗</a></p>`;
    }
  }

  // Reader Drawer Search Highlighter, Copy Link & Quote Card Actions
  document.getElementById('readerSearchInput')?.addEventListener('input', (e) => {
    const contentEl = document.getElementById('drawerContent');
    const badgeEl = document.getElementById('readerMatchBadge');
    if (!contentEl || !activeReaderBaseHtml) return;
    const term = String(e.target.value || '').trim();
    contentEl.innerHTML = activeReaderBaseHtml;
    if (term.length < 2) {
      if (badgeEl) badgeEl.style.display = 'none';
      return;
    }
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escapedTerm})`, 'giu');
    let matchCount = 0;
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const tn of textNodes) {
      const val = tn.nodeValue || '';
      if (!re.test(val)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let m;
      while ((m = re.exec(val)) !== null) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(val.slice(lastIdx, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'reader-hl';
        mark.textContent = m[1];
        frag.appendChild(mark);
        matchCount++;
        lastIdx = m.index + m[1].length;
      }
      if (lastIdx < val.length) frag.appendChild(document.createTextNode(val.slice(lastIdx)));
      tn.parentNode.replaceChild(frag, tn);
    }
    if (badgeEl) {
      badgeEl.style.display = 'inline-flex';
      badgeEl.textContent = matchCount > 0 ? `${toBnNum(matchCount)}টি মিল` : '০টি মিল';
    }
    const firstMark = contentEl.querySelector('mark.reader-hl');
    if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('drawerCopyLinkBtn')?.addEventListener('click', () => {
    const url = activeReaderDoc?.share_url || activeReaderDoc?.dawahx_url || document.getElementById('drawerExternalUrl')?.href;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => showToast('✓ লেখার লিংক কপি হয়েছে!'));
  });

  document.getElementById('drawerFontBtn')?.addEventListener('click', () => {
    fontSizeBtn?.click();
    showToast('✓ লেখার আকার পরিবর্তন হয়েছে');
  });

  // Live Reading Progress Bar inside Slide-Over Article Reader
  const drawerBodyEl = document.getElementById('drawerBody');
  const readerProgressEl = document.getElementById('readerProgressBar');
  drawerBodyEl?.addEventListener('scroll', () => {
    if (!readerProgressEl) return;
    const maxScroll = drawerBodyEl.scrollHeight - drawerBodyEl.clientHeight;
    const pct = maxScroll > 10 ? Math.min(100, Math.round((drawerBodyEl.scrollTop / maxScroll) * 100)) : 100;
    readerProgressEl.style.width = pct + '%';
  });

  document.getElementById('drawerMakeCardBtn')?.addEventListener('click', () => {
    if (!activeReaderDoc) return;
    openQuoteCardModal({
      text: (activeReaderDoc.opening_ruling || activeReaderDoc.answer_body || '').slice(0, 280),
      title: activeReaderDoc.clean_title || activeReaderDoc.title || '',
      source: activeReaderDoc.source_name || 'DAWAH X',
      key: activeReaderDoc.key || '',
    });
  });

  // Model Modal & Live Sync
  openModelModalBtn.addEventListener('click', () => {
    sidebar.classList.remove('open');
    modelModal.classList.add('open');
    backdrop.classList.add('open');
    document.getElementById('llmProvider').value = localStorage.getItem('dawahx_llm_provider') || 'none';
    document.getElementById('llmApiKey').value = localStorage.getItem('dawahx_llm_key') || '';
    const cfInput = document.getElementById('cfWorkerUrlInput');
    if (cfInput) cfInput.value = localStorage.getItem(CF_WORKER_KEY) || DEFAULT_CF_WORKER_URL || '';
    updateCfStatusUI();
  });

  document.getElementById('saveCfWorkerBtn')?.addEventListener('click', async () => {
    const cfInput = document.getElementById('cfWorkerUrlInput');
    const msgEl = document.getElementById('cfSavedMsg');
    const rawVal = String(cfInput?.value || '').trim().replace(/\/+$/, '');
    if (msgEl) {
      msgEl.style.color = 'var(--gold-bright)';
      msgEl.textContent = '⏳ Cloudflare Worker সংযোগ পরীক্ষা করা হচ্ছে...';
    }
    if (rawVal) {
      localStorage.setItem(CF_WORKER_KEY, rawVal);
    } else {
      localStorage.removeItem(CF_WORKER_KEY);
    }
    const ok = await detectCloudflareAI(rawVal);
    if (msgEl) {
      if (ok) {
        msgEl.style.color = 'var(--emerald)';
        msgEl.textContent = '✓ মাশাআল্লাহ! Cloudflare Workers AI (Llama 3.3 70B) সফলভাবে সংযুক্ত হয়েছে!';
      } else {
        msgEl.style.color = '#f87171';
        msgEl.textContent = rawVal
          ? '⚠ Worker URL-এ /api/health সাড়া দেয়নি। URL ও [ai] binding যাচাই করুন।'
          : 'ℹ কাস্টম Worker URL সরানো হয়েছে।';
      }
    }
  });

  document.getElementById('clearCfWorkerBtn')?.addEventListener('click', async () => {
    localStorage.removeItem(CF_WORKER_KEY);
    const cfInput = document.getElementById('cfWorkerUrlInput');
    const msgEl = document.getElementById('cfSavedMsg');
    if (cfInput) cfInput.value = '';
    await detectCloudflareAI('');
    if (msgEl) {
      msgEl.style.color = 'var(--muted)';
      msgEl.textContent = '✓ রিসেট হয়েছে।';
      setTimeout(() => (msgEl.textContent = ''), 2200);
    }
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

  // ===== 64-District Prayer, Sehri, Iftar & Hijri Modal =====
  const prayerCitySelect = document.getElementById('prayerCitySelect');
  const prayerAsrSelect = document.getElementById('prayerAsrSelect');
  const ASR_METHOD_KEY = 'dawahx_asr_method';
  let selectedAsrMethod = localStorage.getItem(ASR_METHOD_KEY) || 'hanafi';

  function renderPrayerModalBody() {
    if (!window.DawahXBrowserAI || !prayerModal) return;
    if (prayerCitySelect && !prayerCitySelect.options.length && Array.isArray(window.DawahXBrowserAI.cities)) {
      prayerCitySelect.innerHTML = window.DawahXBrowserAI.cities
        .map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.bn)} জেলা</option>`)
        .join('');
    }
    if (prayerCitySelect) prayerCitySelect.value = selectedCityId;
    if (prayerAsrSelect) prayerAsrSelect.value = selectedAsrMethod;

    const sched = window.DawahXBrowserAI.getPrayerTimes(selectedCityId, new Date(), selectedAsrMethod);
    const hj = window.DawahXBrowserAI.getHijriDate ? window.DawahXBrowserAI.getHijriDate() : { label: '' };
    const hjEl = document.getElementById('prayerHijriLabel');
    if (hjEl) hjEl.textContent = `${sched.date_label_bn || ''} · ${hj.label}`;

    const bannerEl = document.getElementById('prayerCountdownBanner');
    if (bannerEl) {
      bannerEl.innerHTML = `
        <span>🕌 বর্তমান ওয়াক্ত: <strong>${escHtml(sched.current_waqt)}</strong></span>
        <span>⏳ পরবর্তী (<strong>${escHtml(sched.next_waqt_name)}</strong>): <strong>${escHtml(sched.next_waqt_time)}</strong> (${escHtml(sched.countdown_bn)} বাকি)</span>
      `;
    }

    const tm = sched.times;
    const isShafi = selectedAsrMethod === 'shafi';
    const rows = [
      ['সেহরির শেষ সময় (সতর্কতামূলক)', tm.sehriEnd.label, false],
      ['ফজর শুরু', tm.fajr.label, sched.next_waqt_name === 'ফজর' || sched.next_waqt_name === 'আগামীকাল ফজর'],
      ['সূর্যোদয়', tm.sunrise.label, sched.next_waqt_name === 'সূর্যোদয়'],
      ['যোহর', tm.dhuhr.label, sched.next_waqt_name === 'যোহর'],
      ['আসর (শাফেঈ / আহলে হাদীস — ১ ছায়া)', tm.asr.label, isShafi && sched.next_waqt_name === 'আসর'],
      ['আসর (হানাফী / ই.ফা. — ২ ছায়া)', tm.asrHanafi.label, !isShafi && sched.next_waqt_name === 'আসর'],
      ['মাগরিব / ইফতার (সূর্যাস্ত)', `${tm.maghrib.label}${tm.iftarIfb ? ` (ই.ফা.: ${tm.iftarIfb.short})` : ''}`, sched.next_waqt_name === 'মাগরিব / ইফতার'],
      ['এশা', tm.isha.label, sched.next_waqt_name === 'এশা'],
    ];
    const gridEl = document.getElementById('prayerGridTable');
    if (gridEl) {
      gridEl.innerHTML = rows
        .map(
          ([lbl, val, hi]) => `
          <div class="prayer-cell ${hi ? 'highlight' : ''}">
            <span>${escHtml(lbl)}</span>
            <strong>${escHtml(val)}</strong>
          </div>`
        )
        .join('');
    }
  }

  function openPrayerModal() {
    closeOverlays();
    renderPrayerModalBody();
    if (prayerModal) {
      prayerModal.classList.add('open');
      backdrop.classList.add('open');
    }
  }

  document.getElementById('livePrayerBtn')?.addEventListener('click', openPrayerModal);
  prayerCitySelect?.addEventListener('change', () => {
    selectedCityId = prayerCitySelect.value || 'dhaka';
    localStorage.setItem(CITY_KEY, selectedCityId);
    updateLivePrayerBadge();
    renderPrayerModalBody();
  });
  prayerAsrSelect?.addEventListener('change', () => {
    selectedAsrMethod = prayerAsrSelect.value || 'hanafi';
    localStorage.setItem(ASR_METHOD_KEY, selectedAsrMethod);
    updateLivePrayerBadge();
    renderPrayerModalBody();
  });

  // ===== v4.0 1080x1080 HD Quote / Fatwa Card Generator =====
  const quoteCanvas = document.getElementById('quoteCanvas');
  const quoteTextEl = document.getElementById('quoteCardText');

  function wrapCanvasLines(ctx, text, maxWidth) {
    const out = [];
    for (const para of String(text || '').split('\n')) {
      const words = para.trim().split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxWidth && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  async function drawQuoteCardCanvas() {
    if (!quoteCanvas || !quoteTextEl) return;
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    const ctx = quoteCanvas.getContext('2d');
    const isLight = activeQuoteMeta.theme === 'light';

    // Background & ornamental double Islamic border
    ctx.fillStyle = isLight ? '#faf7ee' : '#07171c';
    ctx.fillRect(0, 0, 1080, 1080);

    ctx.strokeStyle = isLight ? '#b48216' : '#d8aa3e';
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, 984, 984);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(62, 62, 956, 956);

    // Header badge
    ctx.fillStyle = isLight ? '#8a5f06' : '#ffd56a';
    ctx.font = '700 38px "Hind Siliguri", sans-serif';
    ctx.fillText('DAWAH X  ·  দলিলভিত্তিক ইসলামিক উত্তর', 100, 138);

    // Question / Title line
    if (activeQuoteMeta.title) {
      ctx.fillStyle = isLight ? '#185c47' : '#34d399';
      ctx.font = '600 30px "Hind Siliguri", sans-serif';
      const tLines = wrapCanvasLines(ctx, 'প্রশ্ন: ' + activeQuoteMeta.title, 880).slice(0, 2);
      let ty = 200;
      for (const tl of tLines) {
        ctx.fillText(tl, 100, ty);
        ty += 42;
      }
    }

    // Main Answer Quote
    const val = quoteTextEl.value.trim() || 'উদ্ধৃতি লিখুন...';
    let fontSize = 48;
    let lines = [];
    while (fontSize >= 28) {
      ctx.font = `600 ${fontSize}px "Hind Siliguri", sans-serif`;
      lines = wrapCanvasLines(ctx, val, 880);
      if (lines.length * fontSize * 1.46 <= 520) break;
      fontSize -= 2;
    }
    ctx.fillStyle = isLight ? '#102420' : '#f4f7f6';
    ctx.font = `600 ${fontSize}px "Hind Siliguri", sans-serif`;
    let y = activeQuoteMeta.title ? 320 : 260;
    for (const ln of lines.slice(0, 11)) {
      ctx.fillText(ln, 100, y);
      y += fontSize * 1.46;
    }

    // Footer divider & verified source citation
    ctx.strokeStyle = isLight ? 'rgba(154,109,11,0.4)' : 'rgba(216,170,62,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 880);
    ctx.lineTo(980, 880);
    ctx.stroke();

    ctx.fillStyle = isLight ? '#7d5604' : '#ffd56a';
    ctx.font = '700 29px "Hind Siliguri", sans-serif';
    ctx.fillText(`সূত্র: ${activeQuoteMeta.source || 'DAWAH X'}`, 100, 932);

    ctx.fillStyle = isLight ? '#4f6963' : '#9ab4bc';
    ctx.font = '400 25px "Hind Siliguri", sans-serif';
    const refUrl = activeQuoteMeta.key
      ? `ebrahim-ead.github.io/DAWAH-X/s/${activeQuoteMeta.key}.html`
      : 'dawah-x.github.io/card';
    ctx.fillText(refUrl, 100, 978);

    quoteCanvas.toBlob((b) => {
      activeQuoteMeta.blob = b;
    }, 'image/png');
  }

  function openQuoteCardModal({ text, title, source, key }) {
    closeOverlays();
    activeQuoteMeta = { title: title.slice(0, 125), source, key, theme: activeQuoteMeta.theme || 'dark', blob: null };
    if (quoteTextEl) quoteTextEl.value = text.slice(0, 320);
    if (quoteCardModal) {
      quoteCardModal.classList.add('open');
      backdrop.classList.add('open');
      drawQuoteCardCanvas();
    }
  }

  quoteTextEl?.addEventListener('input', drawQuoteCardCanvas);
  document.getElementById('quoteThemeDarkBtn')?.addEventListener('click', () => {
    activeQuoteMeta.theme = 'dark';
    drawQuoteCardCanvas();
  });
  document.getElementById('quoteThemeLightBtn')?.addEventListener('click', () => {
    activeQuoteMeta.theme = 'light';
    drawQuoteCardCanvas();
  });
  document.getElementById('downloadQuotePngBtn')?.addEventListener('click', () => {
    if (!activeQuoteMeta.blob) return;
    const url = URL.createObjectURL(activeQuoteMeta.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dawahx-fatwa-${activeQuoteMeta.key || 'card'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  });
  document.getElementById('shareQuotePngBtn')?.addEventListener('click', async () => {
    if (!activeQuoteMeta.blob) return;
    const file = new File([activeQuoteMeta.blob], 'dawahx-card.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'DAWAH X — দলিলভিত্তিক উত্তর' });
        return;
      } catch (_) {}
    }
    document.getElementById('downloadQuotePngBtn')?.click();
  });

  // ===== v4.0 In-App YouTube Cinema Lightbox & Live Broadcast Poller =====
  function openVideoModal(videoId, title) {
    if (!videoId || !videoModal || !videoModalIframe) return;
    closeOverlays();
    document.getElementById('videoModalTitle').textContent = title || 'DAWAH X Video';
    document.getElementById('videoExternalLink').href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    videoModalIframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    videoModal.classList.add('open');
    backdrop.classList.add('open');
  }

  async function checkLiveBroadcast() {
    const liveBtn = document.getElementById('liveStreamBtn');
    if (!liveBtn || !window.DawahXBrowserAI || !window.DawahXBrowserAI.getLiveStreams) return;
    const streams = await window.DawahXBrowserAI.getLiveStreams();
    if (streams && streams.length > 0) {
      const s = streams[0];
      liveBtn.style.display = 'inline-flex';
      liveBtn.dataset.playVideo = s.id;
      liveBtn.dataset.videoTitle = `${s.channel || 'DAWAH X'} — ${s.title || 'লাইভ সম্প্রচার'}`;
      liveBtn.title = liveBtn.dataset.videoTitle;
    } else {
      liveBtn.style.display = 'none';
    }
  }

  // ===== v4.0 Theme Toggle, Font Size Cycler, Chat Export, Shortcuts & PWA =====
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleBtn) themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    const metaTheme = document.getElementById('metaThemeColor');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#f6f4ee' : '#071419');
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  themeToggleBtn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, cur);
    applyTheme(cur);
  });

  const fontSizeBtn = document.getElementById('fontSizeBtn');
  const FONT_MODES = ['normal', 'font-lg', 'font-xl'];
  function applyFontMode(mode) {
    document.body.classList.remove('font-lg', 'font-xl');
    if (mode === 'font-lg' || mode === 'font-xl') document.body.classList.add(mode);
    if (fontSizeBtn) fontSizeBtn.textContent = mode === 'font-xl' ? 'অ-' : mode === 'font-lg' ? 'অ++' : 'অ+';
  }
  applyFontMode(localStorage.getItem(FONTSIZE_KEY) || 'normal');
  fontSizeBtn?.addEventListener('click', () => {
    const cur = localStorage.getItem(FONTSIZE_KEY) || 'normal';
    const next = FONT_MODES[(FONT_MODES.indexOf(cur) + 1) % FONT_MODES.length];
    localStorage.setItem(FONTSIZE_KEY, next);
    applyFontMode(next);
  });

  document.getElementById('exportChatBtn')?.addEventListener('click', () => {
    if (!currentSessionTurns.length) return;
    const lines = ['=== DAWAH X AI — কথোপকথন ও দলিলসমূহ ===\n'];
    for (const t of currentSessionTurns) {
      lines.push(`প্রশ্ন: ${t.question}`);
      if (t.data.headline) lines.push(`শিরোনাম: ${t.data.headline}`);
      lines.push(`উত্তর: ${t.data.direct_answer}`);
      if (t.data.explanation_paragraphs?.length) lines.push(t.data.explanation_paragraphs.join('\n'));
      if (t.data.primary_url) lines.push(`সূত্র: ${t.data.primary_url}`);
      lines.push('\n----------------------------------------\n');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dawahx-ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && window.innerWidth > 900) {
      e.preventDefault();
      toggleDesktopSidebar();
      return;
    }
    if (e.key === 'Escape') {
      stopSpeech();
      closeOverlays();
    } else if (
      e.code === 'Space' &&
      tasbihModal &&
      tasbihModal.classList.contains('open') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    ) {
      e.preventDefault();
      incrementTasbih();
    } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      questionInput.focus();
    }
  });

  // ===== v6.0 Laptop Collapsible Sidebar, Mobile Header New Chat, Scroll-to-Bottom, Swipe Gestures & Command Palette =====
  const SIDEBAR_COLLAPSED_KEY = 'dawahx_sidebar_collapsed_v6';
  function toggleDesktopSidebar(forceVal) {
    if (!appShell) return;
    const next = typeof forceVal === 'boolean' ? forceVal : !appShell.classList.contains('sidebar-collapsed');
    appShell.classList.toggle('sidebar-collapsed', next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  }
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' && window.innerWidth > 900) {
    appShell?.classList.add('sidebar-collapsed');
  }
  document.getElementById('desktopSidebarToggleBtn')?.addEventListener('click', () => toggleDesktopSidebar());
  document.getElementById('mobileNewChatBtn')?.addEventListener('click', () => {
    newChatBtn.click();
    showToast('নতুন কথোপকথন শুরু হয়েছে');
  });

  // Floating Scroll-to-Bottom Pill
  chatScroll.addEventListener('scroll', () => {
    if (!scrollBottomBtn) return;
    const distFromBottom = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
    scrollBottomBtn.style.display = distFromBottom > 260 ? 'inline-flex' : 'none';
  });
  scrollBottomBtn?.addEventListener('click', () => {
    chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
  });

  // Smartphone Touch Swipe Gestures (Edge-swipe right opens sidebar, swipe left closes sidebar, swipe right closes reader)
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!e.changedTouches || e.changedTouches.length !== 1 || window.innerWidth > 900) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 62 || Math.abs(dy) > Math.abs(dx) * 0.65) return;

      if (dx > 62 && touchStartX <= 26 && !sidebar.classList.contains('open') && !readerDrawer.classList.contains('open')) {
        sidebar.classList.add('open');
        backdrop.classList.add('open');
      } else if (dx < -62 && sidebar.classList.contains('open')) {
        closeOverlays();
      } else if (dx > 75 && readerDrawer.classList.contains('open')) {
        closeOverlays();
      }
    },
    { passive: true }
  );

  // Command Palette (Ctrl+K / Mobile Bolt)
  const CMD_BASE_ACTIONS = [
    { label: '🕌 ২৪ জেলার নামাজ, সেহরি, ইফতার ও হিজরি ক্যালেন্ডার', meta: 'টুল', run: () => openPrayerModal() },
    { label: '⚖️ কুরআনিক ফারায়েয / মিরাস (উত্তরাধিকার) ক্যালকুলেটর', meta: 'টুল', run: () => openMirasModal() },
    { label: '📿 ডিজিটাল তাসবীহ ও মাসনূন যিকির কাউন্টার', meta: 'টুল', run: () => openTasbihModal() },
    { label: '＋ নতুন প্রশ্ন / কথোপকথন শুরু করুন', meta: 'অ্যাকশন', run: () => newChatBtn.click() },
    { label: '☀️ দিন / রাত থিম পরিবর্তন করুন', meta: 'সেটিংস', run: () => themeToggleBtn?.click() },
    { label: 'অ+ লেখার আকার বড় / ছোট করুন', meta: 'সেটিংস', run: () => fontSizeBtn?.click() },
    { label: '🆕 সদ্য প্রকাশিত লেখা ও ভিডিও দেখুন', meta: 'লাইভ', run: () => submitQuestion('আজকে নতুন কি কি লেখা বা ভিডিও এসেছে?') },
    { label: '🧮 ৫ লক্ষ টাকায় কত টাকা যাকাত দিতে হবে?', meta: 'যাকাত', run: () => submitQuestion('৫ লক্ষ টাকায় কত টাকা যাকাত দিতে হবে?') },
    { label: '🎯 একটা ইসলামিক কুইজ ধরো', meta: 'কুইজ', run: () => submitQuestion('একটা ইসলামিক কুইজ ধরো') },
    { label: '📚 শুধু মাসিক আত-তাহরীক থেকে উত্তর ফিল্টার করুন', meta: 'ফিল্টার', run: () => { if (pubSourceSelect) { pubSourceSelect.value = 'at'; pubSourceSelect.dispatchEvent(new Event('change')); showToast('ফিল্টার: মাসিক আত-তাহরীক'); } } },
    { label: '📚 শুধু মাসিক আল-ইতিছাম থেকে উত্তর ফিল্টার করুন', meta: 'ফিল্টার', run: () => { if (pubSourceSelect) { pubSourceSelect.value = 'ai'; pubSourceSelect.dispatchEvent(new Event('change')); showToast('ফিল্টার: মাসিক আল-ইতিছাম'); } } },
    { label: '📚 সব উৎস পুনরায় চালু করুন', meta: 'ফিল্টার', run: () => { if (pubSourceSelect) { pubSourceSelect.value = ''; pubSourceSelect.dispatchEvent(new Event('change')); showToast('ফিল্টার: সব উৎস'); } } },
  ];
  let currentCmdList = [];

  function renderCmdResults(queryText = '') {
    const listEl = document.getElementById('cmdResultsList');
    if (!listEl) return;
    const q = String(queryText || '').trim().toLowerCase();
    const dynamicItems = [];

    // Include saved bookmarks
    for (const bm of loadStoredJson(BOOKMARKS_KEY, []).slice(0, 6)) {
      dynamicItems.push({
        label: `🔖 ${bm.title}`,
        meta: 'সংরক্ষিত',
        run: () => openInlineReader(bm.key),
      });
    }
    // Include instant AI suggestions if user typed >=2 chars
    if (q.length >= 2 && window.DawahXBrowserAI && window.DawahXBrowserAI.suggest) {
      for (const sg of window.DawahXBrowserAI.suggest(q, 5)) {
        dynamicItems.push({
          label: `🔍 ${sg}`,
          meta: 'প্রশ্ন করুন',
          run: () => submitQuestion(sg),
        });
      }
    }

    const pool = [...CMD_BASE_ACTIONS, ...dynamicItems];
    currentCmdList = q
      ? pool.filter((item) => item.label.toLowerCase().includes(q) || item.meta.toLowerCase().includes(q))
      : pool;

    if (q.length >= 2) {
      currentCmdList.push({
        label: `➤ সরাসরি জিজ্ঞেস করুন: “${queryText.trim()}”`,
        meta: 'DAWAH X AI',
        run: () => submitQuestion(queryText.trim()),
      });
    }

    listEl.innerHTML = currentCmdList
      .slice(0, 12)
      .map(
        (it, idx) => `
        <button type="button" class="cmd-item" data-cmd-idx="${idx}">
          <span>${escHtml(it.label)}</span>
          <small>${escHtml(it.meta)}</small>
        </button>`
      )
      .join('');
  }

  function openCmdPalette() {
    closeOverlays();
    if (!cmdModal) return;
    const inp = document.getElementById('cmdSearchInput');
    if (inp) inp.value = '';
    renderCmdResults('');
    cmdModal.classList.add('open');
    backdrop.classList.add('open');
    setTimeout(() => inp?.focus(), 40);
  }

  document.getElementById('cmdPaletteBtn')?.addEventListener('click', openCmdPalette);
  document.getElementById('mobileCmdBtn')?.addEventListener('click', openCmdPalette);
  document.getElementById('cmdSearchInput')?.addEventListener('input', (e) => renderCmdResults(e.target.value));
  document.getElementById('cmdSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentCmdList.length > 0) {
      e.preventDefault();
      const action = currentCmdList[0];
      closeOverlays();
      action.run();
    }
  });
  document.getElementById('cmdResultsList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd-idx]');
    if (!btn) return;
    const action = currentCmdList[Number(btn.getAttribute('data-cmd-idx'))];
    closeOverlays();
    if (action) action.run();
  });

  // ===== v5.0 Qur'anic Fara'id / Miras Calculator Modal =====
  function renderMirasModalResults() {
    if (!mirasModal || !window.DawahXBrowserAI || !window.DawahXBrowserAI.calculateMiras) return;
    const gender = document.getElementById('mirasGender')?.value || 'male';
    const wivesWrap = document.getElementById('mirasWivesWrap');
    const husbandWrap = document.getElementById('mirasHusbandWrap');
    if (wivesWrap) wivesWrap.style.display = gender === 'male' ? '' : 'none';
    if (husbandWrap) husbandWrap.style.display = gender === 'female' ? '' : 'none';

    const res = window.DawahXBrowserAI.calculateMiras({
      deceasedGender: gender,
      netEstate: Number(document.getElementById('mirasEstate')?.value || 0),
      wives: Number(document.getElementById('mirasWives')?.value || 0),
      husband: Number(document.getElementById('mirasHusband')?.value || 0) === 1,
      father: Number(document.getElementById('mirasFather')?.value || 0) === 1,
      mother: Number(document.getElementById('mirasMother')?.value || 0) === 1,
      sons: Number(document.getElementById('mirasSons')?.value || 0),
      daughters: Number(document.getElementById('mirasDaughters')?.value || 0),
    });

    const noteEl = document.getElementById('mirasCaseNote');
    const listEl = document.getElementById('mirasResultsList');
    if (noteEl) noteEl.innerHTML = formatRichText('📌 ' + res.case_note);
    if (!listEl) return;

    if (!res.heirs.length) {
      listEl.innerHTML = `<div class="miras-row">অনুগ্রহ করে অন্তত একজন জীবিত ওয়ারিশ নির্বাচন করুন।</div>`;
      return;
    }

    listEl.innerHTML = res.heirs
      .map(
        (h) => `
        <div class="miras-row">
          <div class="miras-row-top">
            <span class="miras-row-title">${escHtml(h.label)}</span>
            <span class="miras-row-val">${escHtml(h.percentage_bn)}${h.amount_bn ? ' · ' + escHtml(h.amount_bn) : ''}</span>
          </div>
          <div class="miras-bar-track">
            <div class="miras-bar-fill" style="width:${Math.min(100, Math.max(2, h.percentage))}%;"></div>
          </div>
          <div class="miras-row-basis">
            <span>📖 ${escHtml(h.basis)}</span>
            ${h.per_person_bn ? `<strong style="color:var(--emerald);">${escHtml(h.per_person_bn)}</strong>` : ''}
          </div>
        </div>`
      )
      .join('');
  }

  function openMirasModal() {
    closeOverlays();
    if (!mirasModal) return;
    renderMirasModalResults();
    mirasModal.classList.add('open');
    backdrop.classList.add('open');
  }

  document.getElementById('openMirasBtn')?.addEventListener('click', openMirasModal);
  ['mirasGender', 'mirasEstate', 'mirasWives', 'mirasHusband', 'mirasFather', 'mirasMother', 'mirasSons', 'mirasDaughters'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderMirasModalResults);
    el?.addEventListener('change', renderMirasModalResults);
  });

  // ===== v5.0 Digital Tasbih & Sunnah Adhkar Counter =====
  const TASBIH_PRESETS = [
    { ar: 'سُبْحَانَ اللَّهِ', bn: 'সুবহানাল্লাহ — আল্লাহ পবিত্র ও মহিমাময়', target: 33 },
    { ar: 'الْحَمْدُ لِلَّهِ', bn: 'আলহামদুলিল্লাহ — সকল প্রশংসা আল্লাহর জন্য', target: 33 },
    { ar: 'اللَّهُ أَكْبَرُ', bn: 'আল্লাহু আকবার — আল্লাহ সর্বশ্রেষ্ঠ', target: 34 },
    { ar: 'أَسْتَغْفِرُ اللَّهَ', bn: 'আস্তাগফিরুল্লাহ — আমি আল্লাহর কাছে ক্ষমা চাইছি', target: 100 },
    { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', bn: 'সুবহানাল্লাহি ওয়া বিহামদিহি (সহীহ বুখারী ৬৪০৫)', target: 100 },
    { ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', bn: 'লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারীকা লাহু...', target: 100 },
    { ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', bn: 'দরূদ শরীফ — নবীজি ﷺ-এর ওপর সালাত ও সালাম', target: 10 },
  ];
  const TASBIH_STORAGE_KEY = 'dawahx_tasbih_daily_v5';
  let tasbihIdx = 0;
  let tasbihCount = 0;

  function getTasbihDailyRecord() {
    const today = new Date().toISOString().slice(0, 10);
    const saved = loadStoredJson(TASBIH_STORAGE_KEY, { date: today, total: 0 });
    return saved.date === today ? saved : { date: today, total: 0 };
  }

  function renderTasbihState() {
    const presetSelect = document.getElementById('tasbihPresetSelect');
    if (presetSelect && !presetSelect.options.length) {
      presetSelect.innerHTML = TASBIH_PRESETS.map(
        (p, idx) => `<option value="${idx}">${escHtml(p.bn.split('—')[0].trim())} (${toBnNum(p.target)} বার)</option>`
      ).join('');
    }
    if (presetSelect) presetSelect.value = String(tasbihIdx);

    const p = TASBIH_PRESETS[tasbihIdx] || TASBIH_PRESETS[0];
    const arEl = document.getElementById('tasbihArabic');
    const mnEl = document.getElementById('tasbihMeaning');
    const numEl = document.getElementById('tasbihCountNum');
    const tgtEl = document.getElementById('tasbihTargetLbl');
    const tapBtn = document.getElementById('tasbihTapBtn');
    const dailyEl = document.getElementById('tasbihDailyTotal');

    if (arEl) arEl.textContent = p.ar;
    if (mnEl) mnEl.textContent = `${p.bn}`;
    if (numEl) numEl.textContent = toBnNum(tasbihCount);
    if (tgtEl) tgtEl.textContent = tasbihCount >= p.target ? `✓ মাশাআল্লাহ! লক্ষ্য (${toBnNum(p.target)}) পূর্ণ` : `লক্ষ্য: ${toBnNum(p.target)}`;
    if (tapBtn) tapBtn.classList.toggle('completed', tasbihCount >= p.target);
    if (dailyEl) dailyEl.textContent = `আজকের মোট যিকির: ${toBnNum(getTasbihDailyRecord().total)}`;
  }

  function incrementTasbih() {
    const p = TASBIH_PRESETS[tasbihIdx] || TASBIH_PRESETS[0];
    tasbihCount++;
    const rec = getTasbihDailyRecord();
    rec.total++;
    saveStoredJson(TASBIH_STORAGE_KEY, rec);
    if (navigator.vibrate) {
      navigator.vibrate(tasbihCount === p.target ? [35, 50, 75] : 15);
    }
    renderTasbihState();
  }

  function openTasbihModal() {
    closeOverlays();
    if (!tasbihModal) return;
    renderTasbihState();
    tasbihModal.classList.add('open');
    backdrop.classList.add('open');
  }

  document.getElementById('openTasbihBtn')?.addEventListener('click', openTasbihModal);
  document.getElementById('hdrTasbihBtn')?.addEventListener('click', openTasbihModal);
  document.getElementById('tasbihTapBtn')?.addEventListener('click', incrementTasbih);
  document.getElementById('tasbihResetBtn')?.addEventListener('click', () => {
    tasbihCount = 0;
    renderTasbihState();
  });
  document.getElementById('tasbihNextDhikrBtn')?.addEventListener('click', () => {
    tasbihIdx = (tasbihIdx + 1) % TASBIH_PRESETS.length;
    tasbihCount = 0;
    renderTasbihState();
  });
  document.getElementById('tasbihPresetSelect')?.addEventListener('change', (e) => {
    tasbihIdx = Number(e.target.value) || 0;
    tasbihCount = 0;
    renderTasbihState();
  });

  // PWA Service Worker & Install Prompt
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const installPwaBtn = document.getElementById('installPwaBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installPwaBtn) installPwaBtn.style.display = 'flex';
  });
  installPwaBtn?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    deferredInstallPrompt = null;
    installPwaBtn.style.display = 'none';
  });

  renderSidebarLists();
  updateLivePrayerBadge();
  setInterval(updateLivePrayerBadge, 45000);
  checkLiveBroadcast();
  setInterval(checkLiveBroadcast, 120000);
  const cfReadyPromise = detectCloudflareAI();
  Promise.all([loadStats(), cfReadyPromise]).then(() => {
    // Support shareable ?q=... deep query links!
    const urlQ = new URLSearchParams(location.search).get('q');
    if (urlQ && urlQ.trim()) {
      submitQuestion(urlQ.trim());
    }
  });
})();
