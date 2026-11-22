/* ===== DAWAH X AI — Clean, Accurate & Complete Client Engine ===== */
(function () {
  'use strict';

  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBnNum = (val) =>
    String(val).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

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

  // Check whether a Bengali / English / Arabic answer ended cleanly on sentence punctuation
  function isCompleteSentence(txt) {
    const trimmed = String(txt || '').trim();
    if (!trimmed) return false;
    return /[।?!.)”'"\]*»﴾]\s*$/u.test(trimmed);
  }

  let activeFilter = 'all';
  let isAsking = false;
  let backendAvailable = null;
  let chatHistory = [];
  let currentSessionId = 'sess_' + Date.now();
  let currentSessionTurns = [];
  let activeTtsBtn = null;

  const SESSIONS_KEY = 'dawahx_sessions_v3';
  const BOOKMARKS_KEY = 'dawahx_bookmarks_v3';
  const CITY_KEY = 'dawahx_user_city_v4';
  const ASR_METHOD_KEY = 'dawahx_asr_method';
  const THEME_KEY = 'dawahx_theme_v4';
  const FONTSIZE_KEY = 'dawahx_fontsize_v4';
  const CF_WORKER_KEY = 'dawahx_cf_worker_url_v1';
  const DEFAULT_CF_WORKER_URL = String(
    window.DAWAHX_WORKER_URL || 'https://ead.ead123628.workers.dev'
  )
    .trim()
    .replace(/\/+$/, '');

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
  let selectedAsrMethod = localStorage.getItem(ASR_METHOD_KEY) || 'hanafi';

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

    const utter = new SpeechSynthesisUtterance(clean.slice(0, 2200));
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
      const p = window.DawahXBrowserAI.getPrayerTimes(selectedCityId, new Date(), selectedAsrMethod);
      const label = `🕌 ${p.city} · ${p.next_waqt_name}: ${p.next_waqt_time}`;
      const tip = `${p.city} — বর্তমান: ${p.current_waqt} | পরবর্তী (${p.next_waqt_name}): ${p.next_waqt_time} (${p.countdown_bn} বাকি)`;
      const btn = document.getElementById('livePrayerBtn');
      if (btn) {
        btn.textContent = label;
        btn.title = tip;
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
  const prayerModal = document.getElementById('prayerModal');
  const videoModal = document.getElementById('videoModal');
  const videoModalIframe = document.getElementById('videoModalIframe');
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
    sidebar?.classList.remove('open');
    readerDrawer?.classList.remove('open');
    prayerModal?.classList.remove('open');
    if (videoModal) {
      videoModal.classList.remove('open');
      if (videoModalIframe) videoModalIframe.src = '';
    }
    hideSuggestions();
    backdrop?.classList.remove('open');
  }

  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('open');
  });
  closeSidebarBtn?.addEventListener('click', closeOverlays);
  closeDrawerBtn?.addEventListener('click', closeOverlays);
  backdrop?.addEventListener('click', closeOverlays);

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
  newChatBtn?.addEventListener('click', () => {
    stopSpeech();
    chatContainer.querySelectorAll('.msg-user, .msg-ai-card, .msg-ai-chat, .thinking-card').forEach((el) => el.remove());
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
  filterList?.addEventListener('click', (e) => {
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
      filterList?.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      activeFilter = val;
    } else {
      const allBtn = filterList?.querySelector('[data-filter="all"]');
      if (allBtn) allBtn.classList.add('active');
      activeFilter = 'all';
    }
    if (window.innerWidth <= 900) closeOverlays();
  });

  // Delegate clicks on starter cards, topic buttons, follow-up chips, reader buttons, copy/share/bookmark buttons
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
          showToast('✓ প্রশ্নের লিংক কপি হয়েছে!');
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
      const title = bmBtn.getAttribute('data-bookmark-title') || 'সংরক্ষিত উত্তর';
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

    const playVidTrigger = e.target.closest('[data-play-video]');
    if (playVidTrigger) {
      e.preventDefault();
      openVideoModal(
        playVidTrigger.getAttribute('data-play-video'),
        playVidTrigger.getAttribute('data-video-title') || 'DAWAH X Video'
      );
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

  // Warm corpus index & probe optional local FastAPI backend
  async function initCorpusWarmup() {
    try {
      if (backendAvailable !== false && !location.hostname.endsWith('.github.io') && !location.hostname.endsWith('.workers.dev')) {
        try {
          const res = await fetch('api/stats');
          const ctype = res.headers.get('content-type') || '';
          backendAvailable = Boolean(res.ok && ctype.includes('application/json'));
        } catch (_) {
          backendAvailable = false;
        }
      } else {
        backendAvailable = false;
      }
      if (!backendAvailable && window.DawahXBrowserAI) {
        await window.DawahXBrowserAI.init();
      }
    } catch (_) {}
  }

  function updateCfStatusUI() {
    const pill = document.getElementById('headerAiPill');
    if (pill) {
      pill.classList.toggle('cf-live', cfAiAvailable);
      pill.title = cfAiAvailable
        ? `Cloudflare Workers AI সক্রিয় (${cfAiModelName})`
        : 'DAWAH X AI ইঞ্জিন';
    }
  }

  async function detectCloudflareAI(explicitUrl) {
    let candidateBase =
      explicitUrl !== undefined
        ? String(explicitUrl || '').trim().replace(/\/+$/, '')
        : (localStorage.getItem(CF_WORKER_KEY) || DEFAULT_CF_WORKER_URL).trim().replace(/\/+$/, '');

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
    data.ai_generated = generatedText;
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      if (chatHistory[i].role === 'assistant') {
        chatHistory[i].text = generatedText.slice(0, 1400);
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

  // Stream a single SSE pass from Cloudflare Workers AI, properly flushing trailing multi-byte UTF-8 chunks
  async function streamCloudflarePass(aiUrl, payloadBody, onToken) {
    const res = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBody),
    });
    if (!res.ok || !res.body) throw new Error('Stream unavailable');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf = '';
    let passText = '';
    let hadStreamError = false;

    const processLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      try {
        const evt = JSON.parse(payload);
        if (evt.error) {
          hadStreamError = true;
          return;
        }
        if (typeof evt.token === 'string' && evt.token) {
          passText += evt.token;
          onToken(evt.token);
        }
      } catch (_) {}
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuf += decoder.decode(value, { stream: true });
      const lines = sseBuf.split(/\r?\n/);
      sseBuf = lines.pop() || '';
      for (const ln of lines) processLine(ln);
    }

    // Flush remaining decoder bytes + trailing line
    sseBuf += decoder.decode();
    for (const ln of sseBuf.split(/\r?\n/)) {
      if (ln.trim()) processLine(ln);
    }

    return { passText, hadStreamError };
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

    if (!cfAiAvailable) return;

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
        `<span data-stream-status>✦ বিস্তারিত ব্যাখ্যা তৈরি হচ্ছে...</span>` +
        `<small>DAWAH X দলিলভিত্তিক</small>` +
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
      let fullText = '';
      let rafScheduled = false;

      const flushRender = (doneNow) => {
        rafScheduled = false;
        if (!streamBody) return;
        if (!fullText && !doneNow) return;
        streamBody.innerHTML =
          formatRichText(fullText.trim()) + (doneNow ? '' : '<span class="stream-cursor"></span>');
      };

      const onChunk = () => {
        if (!rafScheduled) {
          rafScheduled = true;
          requestAnimationFrame(() => flushRender(false));
        }
      };

      const basePayload = {
        question,
        mode,
        stream: true,
        headline: data.headline || '',
        primary_verdict: hasRag ? data.direct_answer || '' : '',
        history: (historySnapshot || chatHistory.slice(0, -2)).slice(-6),
        rag_context: hasRag ? data.rag_context.slice(0, 3) : [],
        evidences: Array.isArray(data.evidences) ? data.evidences.slice(0, 3) : [],
      };

      const firstPass = await streamCloudflarePass(aiUrl, basePayload, (tok) => {
        fullText += tok;
        onChunk();
      });

      // If stream errored before producing a meaningful answer, restore complete verbatim DAWAH X text!
      if (firstPass.hadStreamError && fullText.trim().length < 140) {
        targetEl.innerHTML = fallbackHtml;
        return;
      }

      // Seamless Auto-Continuation: if answer hit token boundary mid-sentence, automatically complete it!
      if (fullText.trim().length >= 90 && !isCompleteSentence(fullText)) {
        try {
          await streamCloudflarePass(
            aiUrl,
            {
              ...basePayload,
              mode: 'continue',
              partial_answer: fullText,
            },
            (tok) => {
              const needsSpace =
                fullText &&
                !/\s$/.test(fullText) &&
                !/^[\s।?!.,:;)\]”'"]/u.test(tok);
              fullText += (needsSpace ? ' ' : '') + tok;
              onChunk();
            }
          );
        } catch (_) {}
      }

      const cleaned = fullText.trim();
      if (cleaned && isCompleteSentence(cleaned)) {
        flushRender(true);
        if (statusSpan) statusSpan.textContent = '✓ দলিলভিত্তিক বিস্তারিত বিশ্লেষণ';
        applyGeneratedAnswerToCard(answerCard, data, cleaned);
        return;
      }
      if (cleaned.length >= 180) {
        fullText = cleaned + '।';
        flushRender(true);
        if (statusSpan) statusSpan.textContent = '✓ দলিলভিত্তিক বিস্তারিত বিশ্লেষণ';
        applyGeneratedAnswerToCard(answerCard, data, fullText);
        return;
      }

      targetEl.innerHTML = fallbackHtml;
    } catch (_) {
      targetEl.innerHTML = fallbackHtml;
    }
  }

  function renderAnswerCard(data) {
    const card = document.createElement('article');
    card.className = 'msg-ai-card';

    let statusBadgeHtml = '';
    if (data.status === 'not_found') {
      statusBadgeHtml = `<span class="badge-notfound">⚠ সরাসরি উত্তর পাওয়া যায়নি</span>`;
    } else if (data.status === 'conversational') {
      statusBadgeHtml = `<span class="badge-verified">✓ DAWAH X AI</span>`;
    } else {
      statusBadgeHtml = `<span class="badge-verified">✓ যাচাইকৃত দলিলভিত্তিক উত্তর</span>`;
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
        : `<div class="ai-stream-box"><div class="ai-stream-head"><span>✓ দলিলভিত্তিক বিস্তারিত বিশ্লেষণ</span><small>DAWAH X দলিলভিত্তিক</small></div><div class="ai-stream-body">${formatRichText(data.ai_generated)}</div></div>` +
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
              <button type="button" class="dalil-copy-btn" data-copy-answer="${escHtml(ev.text + ' — ' + ev.source_name)}">📋 কপি</button>
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
                  📄 সম্পূর্ণ লেখা পড়ুন
                </button>
                <a href="${escHtml(s.dawahx_url)}" target="_blank" rel="noopener noreferrer" class="src-action-btn gold-link">
                  মূল সাইটে দেখুন ↗
                </a>
              </div>
            </div>`;
        })
        .join('');
      sourcesHtml = `
        <div class="sources-section">
          <div class="sec-heading">🔗 DAWAH X তথ্যসূত্র (${toBnNum(data.sources.length)}টি)</div>
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
          <div class="sec-heading">🎬 প্রাসঙ্গিক ভিডিও আলোচনা</div>
          <div class="videos-grid">${vCards}</div>
        </div>`;
    }

    // Conversational / Tool Bubble Mode
    if (data.is_chat || data.status === 'conversational' || data.status === 'not_found') {
      const wrap = document.createElement('article');
      wrap.className = 'msg-ai-chat';

      const quickChips = (data.follow_ups || [])
        .map((fq) => `<button type="button" class="followup-chip" data-q="${escHtml(fq)}">${escHtml(fq)}</button>`)
        .join('');
      const quickHtml = quickChips ? `<div class="chat-quick-replies">${quickChips}</div>` : '';

      const notFoundAction =
        data.status === 'not_found'
          ? `<div style="margin-top:6px;"><a href="${escHtml(data.ask_team_url || 'https://ebrahim-ead.github.io/DAWAH-X/ask.html')}" target="_blank" rel="noopener noreferrer" class="src-action-btn gold-link">✉ শরঈ প্রশ্ন হলে DAWAH X টিমে পাঠান ↗</a></div>`
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
          <summary>📋 মূল প্রশ্ন ও প্রেক্ষাপট দেখুন</summary>
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

    // Clean related follow-up questions
    const topicChips = (data.follow_ups || [])
      .slice(0, 4)
      .map((fq) => `<button type="button" class="followup-chip" data-q="${escHtml(fq)}">↳ ${escHtml(fq)}</button>`)
      .join('');
    const followUpHtml = topicChips
      ? `
        <div class="sources-section">
          <div class="sec-heading">💡 প্রাসঙ্গিক অন্যান্য প্রশ্ন</div>
          <div class="followup-wrap">${topicChips}</div>
        </div>`
      : '';

    const plainCopyText = [
      `প্রশ্ন: ${data.query}`,
      `উত্তর (${data.primary_source_name || 'DAWAH X'}): ${data.ai_generated || data.direct_answer}`,
      ...(data.ai_generated ? [] : data.explanation_paragraphs || []),
      data.primary_url ? `সূত্র: ${data.primary_url}` : `ওয়েবসাইট: https://ebrahim-ead.github.io/DAWAH-X/`,
    ].join('\n\n');

    const ttsFullText = [data.headline, data.ai_generated || data.direct_answer, ...(data.ai_generated ? [] : data.explanation_paragraphs || [])].join('। ');
    const isBookmarked = data.primary_key && loadStoredJson(BOOKMARKS_KEY, []).some((b) => b.key === data.primary_key);
    const bookmarkBtnHtml = data.primary_key
      ? `<button type="button" class="mini-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${escHtml(data.primary_key)}" data-bookmark-title="${escHtml(data.headline)}">${isBookmarked ? '✓ সংরক্ষিত' : '🔖 সংরক্ষণ'}</button>`
      : '';

    card.innerHTML = `
      <div class="ai-meta-top">
        ${statusBadgeHtml}
        ${srcBadgeHtml}
      </div>
      <h3 class="ai-headline">${escHtml(data.headline)}</h3>
      ${scenarioHtml}
      <div class="ai-direct-verdict">
        <strong class="verdict-lbl">মূল সিদ্ধান্ত:</strong>
        <span>${formatRichText(data.direct_answer)}</span>
      </div>
      <div class="ai-explanation" data-llm-slot>${explanationHtml}</div>
      ${seriesHtml}
      ${dalilHtml}
      ${sourcesHtml}
      ${videosHtml}
      ${followUpHtml}
      <div class="card-actions-bar">
        <button type="button" class="mini-btn" data-speak-text="${escHtml(ttsFullText)}">🔊 শুনুন</button>
        ${bookmarkBtnHtml}
        <button type="button" class="mini-btn" data-copy-answer="${escHtml(plainCopyText)}">📋 কপি</button>
        <button type="button" class="mini-btn" data-share-q="${escHtml(data.query || data.headline || '')}">🔗 শেয়ার</button>
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
    loader.innerHTML = `<div class="spinner"></div><span>উত্তর খোঁজা হচ্ছে...</span>`;
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

      const slot = answerCard.querySelector('[data-llm-slot]');
      maybeEnhanceWithBrowserLLM(question, data, slot, answerCard, historySnapshot);
    } catch (_) {
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

  // Inline Full-Article Reader Drawer
  async function openInlineReader(key) {
    if (!key || !readerDrawer) return;
    readerDrawer.classList.add('open');
    backdrop?.classList.add('open');
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

  // Reader Drawer Search Highlighter & Controls
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

  const fontSizeBtn = document.getElementById('fontSizeBtn');
  document.getElementById('drawerFontBtn')?.addEventListener('click', () => {
    fontSizeBtn?.click();
    showToast('✓ লেখার আকার পরিবর্তন হয়েছে');
  });

  const drawerBodyEl = document.getElementById('drawerBody');
  const readerProgressEl = document.getElementById('readerProgressBar');
  drawerBodyEl?.addEventListener('scroll', () => {
    if (!readerProgressEl) return;
    const maxScroll = drawerBodyEl.scrollHeight - drawerBodyEl.clientHeight;
    const pct = maxScroll > 10 ? Math.min(100, Math.round((drawerBodyEl.scrollTop / maxScroll) * 100)) : 100;
    readerProgressEl.style.width = pct + '%';
  });

  // Voice Speech-to-Text (bn-BD)
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec && voiceBtn) {
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
  } else if (voiceBtn) {
    voiceBtn.style.display = 'none';
  }

  // ===== 64-District Prayer, Sehri, Iftar & Hijri Modal =====
  const prayerCitySelect = document.getElementById('prayerCitySelect');
  const prayerAsrSelect = document.getElementById('prayerAsrSelect');

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
      backdrop?.classList.add('open');
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

  // In-App YouTube Cinema Lightbox & Live Broadcast Poller
  function openVideoModal(videoId, title) {
    if (!videoId || !videoModal || !videoModalIframe) return;
    closeOverlays();
    document.getElementById('videoModalTitle').textContent = title || 'DAWAH X Video';
    document.getElementById('videoExternalLink').href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    videoModalIframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    videoModal.classList.add('open');
    backdrop?.classList.add('open');
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

  // Theme Toggle & Font Size Cycler
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

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && window.innerWidth > 900) {
      e.preventDefault();
      toggleDesktopSidebar();
      return;
    }
    if (e.key === 'Escape') {
      stopSpeech();
      closeOverlays();
    } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      questionInput.focus();
    }
  });

  // Collapsible Sidebar, Mobile Header New Chat, Scroll-to-Bottom & Touch Swipe Gestures
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
    newChatBtn?.click();
    showToast('নতুন আলোচনা শুরু হয়েছে');
  });

  chatScroll.addEventListener('scroll', () => {
    if (!scrollBottomBtn) return;
    const distFromBottom = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
    scrollBottomBtn.style.display = distFromBottom > 260 ? 'inline-flex' : 'none';
  });
  scrollBottomBtn?.addEventListener('click', () => {
    chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
  });

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

      if (dx > 62 && touchStartX <= 26 && !sidebar?.classList.contains('open') && !readerDrawer?.classList.contains('open')) {
        sidebar?.classList.add('open');
        backdrop?.classList.add('open');
      } else if (dx < -62 && sidebar?.classList.contains('open')) {
        closeOverlays();
      } else if (dx > 75 && readerDrawer?.classList.contains('open')) {
        closeOverlays();
      }
    },
    { passive: true }
  );

  // PWA Service Worker
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  renderSidebarLists();
  updateLivePrayerBadge();
  setInterval(updateLivePrayerBadge, 45000);
  checkLiveBroadcast();
  setInterval(checkLiveBroadcast, 120000);

  const cfReadyPromise = detectCloudflareAI();
  Promise.all([initCorpusWarmup(), cfReadyPromise]).then(() => {
    const urlQ = new URLSearchParams(location.search).get('q');
    if (urlQ && urlQ.trim()) {
      submitQuestion(urlQ.trim());
    }
  });
})();
