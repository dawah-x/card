/* ===== DAWAH X AI — Pure Question & Answer Client Engine ===== */
(function () {
  'use strict';

  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBnNum = (val) => String(val).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

  const escHtml = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  function formatRichText(text) {
    let safe = escHtml(text);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(
      /([\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F\u0670\uFD50-\uFDFF\uFE70-\uFEFF۝﴿﴾().,،؛:«»\-]{3,})/g,
      '<span class="ar-inline">$1</span>'
    );
    safe = safe
      .split(/\n{2,}/)
      .map((para) => `<p>${para.trim().replace(/\n/g, '<br>')}</p>`)
      .join('');
    return safe;
  }

  const SESSIONS_KEY = 'dawahx_qa_sessions_v5';
  const THEME_KEY = 'dawahx_theme_v4';
  const SIDEBAR_COLLAPSED_KEY = 'dawahx_sidebar_collapsed_v1';
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

  let isAsking = false;
  let backendAvailable = null;
  let cfAiAvailable = false;
  let cfAiEndpointBase = '';
  let chatHistory = [];
  let currentSessionId = 'sess_' + Date.now();
  let currentSessionTurns = [];
  let activeTtsBtn = null;
  let toastTimer = null;

  // DOM Elements
  const appShell = document.getElementById('appShell');
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const desktopSidebarToggleBtn = document.getElementById('desktopSidebarToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const headerNewChatBtn = document.getElementById('headerNewChatBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const headerAiPill = document.getElementById('headerAiPill');

  const chatScroll = document.getElementById('chatScroll');
  const chatContainer = document.getElementById('chatContainer');
  const welcomeHero = document.getElementById('welcomeHero');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');

  const askForm = document.getElementById('askForm');
  const questionInput = document.getElementById('questionInput');
  const suggestDropdown = document.getElementById('suggestDropdown');
  const voiceBtn = document.getElementById('voiceBtn');
  const sendBtn = document.getElementById('sendBtn');

  const backdrop = document.getElementById('backdrop');
  const readerDrawer = document.getElementById('readerDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerBody = document.getElementById('drawerBody');
  const readerProgressBar = document.getElementById('readerProgressBar');
  const videoModal = document.getElementById('videoModal');
  const videoIframe = document.getElementById('videoIframe');
  const appToast = document.getElementById('appToast');

  function showToast(msg) {
    if (!appToast) return;
    appToast.textContent = msg;
    appToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => appToast.classList.remove('show'), 2200);
  }

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

  // Theme Management
  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    if (themeToggleBtn) themeToggleBtn.textContent = isLight ? '🌙' : '☀️';
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', isLight ? '#f8f6f0' : '#050e13');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  }

  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  themeToggleBtn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'light' ? 'dark' : 'light');
  });

  // Sidebar & Overlays
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
    appShell?.classList.add('sidebar-collapsed');
  }

  desktopSidebarToggleBtn?.addEventListener('click', () => {
    const collapsed = appShell.classList.toggle('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      desktopSidebarToggleBtn?.click();
    } else if (e.key === 'Escape') {
      closeOverlays();
    }
  });

  function closeOverlays() {
    sidebar?.classList.remove('open');
    readerDrawer?.classList.remove('open');
    if (videoModal?.classList.contains('open')) {
      videoModal.classList.remove('open');
      if (videoIframe) videoIframe.src = '';
    }
    backdrop?.classList.remove('open');
  }

  mobileMenuBtn?.addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  });
  closeSidebarBtn?.addEventListener('click', closeOverlays);
  closeDrawerBtn?.addEventListener('click', closeOverlays);
  backdrop?.addEventListener('click', closeOverlays);
  document.querySelectorAll('[data-close-modal]').forEach((btn) =>
    btn.addEventListener('click', closeOverlays)
  );

  // Touch Swipe Gestures on Mobile
  let touchX = 0;
  let touchY = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = Math.abs(e.changedTouches[0].clientY - touchY);
      if (dy > 60) return;
      if (touchX < 28 && dx > 65 && !readerDrawer.classList.contains('open')) {
        sidebar.classList.add('open');
        backdrop.classList.add('open');
      } else if (dx < -70 && sidebar.classList.contains('open')) {
        closeOverlays();
      } else if (dx > 80 && readerDrawer.classList.contains('open')) {
        closeOverlays();
      }
    },
    { passive: true }
  );

  // Speech Synthesis (Bangla TTS)
  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (activeTtsBtn) {
      activeTtsBtn.textContent = '🔊 শুনুন';
      activeTtsBtn = null;
    }
  }

  function toggleSpeak(btn, text) {
    if (!('speechSynthesis' in window)) {
      showToast('আপনার ব্রাউজারে অডিও সাপোর্ট নেই');
      return;
    }
    if (activeTtsBtn === btn) {
      stopSpeech();
      return;
    }
    stopSpeech();
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1800);
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'bn-BD';
    utter.rate = 0.96;
    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('bn'));
    if (bnVoice) utter.voice = bnVoice;
    activeTtsBtn = btn;
    btn.textContent = '⏹ থামান';
    utter.onend = () => {
      if (activeTtsBtn === btn) {
        btn.textContent = '🔊 শুনুন';
        activeTtsBtn = null;
      }
    };
    utter.onerror = utter.onend;
    window.speechSynthesis.speak(utter);
  }

  // Saved Q&A Sessions
  function persistCurrentSession() {
    if (!currentSessionTurns.length) return;
    const sessions = loadStoredJson(SESSIONS_KEY, []);
    const title = currentSessionTurns[0].question.slice(0, 64);
    const entry = {
      id: currentSessionId,
      title,
      updatedAt: Date.now(),
      turns: currentSessionTurns.slice(-16),
    };
    const idx = sessions.findIndex((s) => s.id === currentSessionId);
    if (idx >= 0) sessions[idx] = entry;
    else sessions.unshift(entry);
    saveStoredJson(SESSIONS_KEY, sessions.slice(0, 25));
    renderHistoryList();
  }

  function renderHistoryList() {
    if (!historyList) return;
    const sessions = loadStoredJson(SESSIONS_KEY, []);
    if (!sessions.length) {
      historyList.innerHTML = `<div class="empty-note">এখনও কোনো প্রশ্ন করা হয়নি</div>`;
      return;
    }
    historyList.innerHTML = sessions
      .map(
        (s) => `
        <div class="history-item ${s.id === currentSessionId ? 'active' : ''}">
          <button type="button" class="history-item-title" data-load-session="${escHtml(s.id)}">${escHtml(s.title)}</button>
          <button type="button" class="history-del-btn" data-del-session="${escHtml(s.id)}" title="মুছুন">✕</button>
        </div>`
      )
      .join('');
  }

  function startNewChat() {
    stopSpeech();
    closeOverlays();
    currentSessionId = 'sess_' + Date.now();
    currentSessionTurns = [];
    chatHistory = [];
    Array.from(chatContainer.children).forEach((el) => {
      if (el !== welcomeHero) el.remove();
    });
    welcomeHero.style.display = 'flex';
    renderHistoryList();
    questionInput.focus();
  }

  newChatBtn?.addEventListener('click', startNewChat);
  headerNewChatBtn?.addEventListener('click', startNewChat);

  clearHistoryBtn?.addEventListener('click', () => {
    localStorage.removeItem(SESSIONS_KEY);
    renderHistoryList();
    showToast('✓ ইতিহাস মুছে ফেলা হয়েছে');
  });

  historyList?.addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-session]');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.getAttribute('data-del-session');
      const next = loadStoredJson(SESSIONS_KEY, []).filter((s) => s.id !== id);
      saveStoredJson(SESSIONS_KEY, next);
      if (id === currentSessionId) startNewChat();
      else renderHistoryList();
      return;
    }
    const loadBtn = e.target.closest('[data-load-session]');
    if (loadBtn) {
      const id = loadBtn.getAttribute('data-load-session');
      const found = loadStoredJson(SESSIONS_KEY, []).find((s) => s.id === id);
      if (!found) return;
      stopSpeech();
      closeOverlays();
      currentSessionId = found.id;
      currentSessionTurns = found.turns || [];
      chatHistory = [];
      Array.from(chatContainer.children).forEach((el) => {
        if (el !== welcomeHero) el.remove();
      });
      welcomeHero.style.display = currentSessionTurns.length ? 'none' : 'flex';
      for (const turn of currentSessionTurns) {
        const u = document.createElement('div');
        u.className = 'msg-user';
        u.textContent = turn.question;
        chatContainer.appendChild(u);

        const aiNode = renderUnifiedAnswer(turn.data);
        chatContainer.appendChild(aiNode);

        chatHistory.push({ role: 'user', text: turn.question });
        chatHistory.push({
          role: 'assistant',
          text: turn.data.ai_generated || turn.data.direct_answer || '',
          primary_title: turn.data.headline || '',
          extra_body: turn.data.extra_body || '',
          evidences: turn.data.evidences || [],
          sources: turn.data.sources || [],
        });
      }
      renderHistoryList();
      chatScroll.scrollTop = chatScroll.scrollHeight;
    }
  });

  // Auto-Detection of Cloudflare Workers AI (`https://ead.ead123628.workers.dev`) & Optional Python Server
  async function detectEngines() {
    if (!location.hostname.endsWith('.github.io')) {
      try {
        const r = await fetch('api/stats');
        const ct = r.headers.get('content-type') || '';
        backendAvailable = r.ok && ct.includes('application/json');
      } catch (_) {
        backendAvailable = false;
      }
    } else {
      backendAvailable = false;
    }

    let candidateBase = (localStorage.getItem(CF_WORKER_KEY) || DEFAULT_CF_WORKER_URL)
      .trim()
      .replace(/\/+$/, '');
    if (candidateBase && location.origin === candidateBase) {
      candidateBase = '';
    }
    if (!candidateBase && location.hostname.endsWith('.github.io')) return;

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
          headerAiPill?.classList.add('cf-live');
        }
      }
    } catch (_) {
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Smart Contextual Query Augmentation for Short Multi-Turn Follow-up Questions
  const FOLLOWUP_PREFIX_RE = /^(?:আর\b|তাহলে\b|এক্ষেত্রে\b|সেক্ষেত্রে\b|যদি\b|কিন্তু\b|এর\b|এটার\b|ওটার\b|এতে\b|এখন\b|আচ্ছা\b)/u;
  const PURE_ELABORATION_RE = /^(?:আরেকটু\s*(?:বিস্তারিত|সহজ\s*করে|খুলে|পরিষ্কার\s*করে)|উদাহরণ\s*দাও|সংক্ষেপে\s*বলো|ইংরেজিতে\s*(?:বলো|অনুবাদ\s*করো)|explain\s*more|in\s*english|simplify)/iu;

  function buildRetrievalQuery(question, historySnap) {
    const q = question.trim();
    if (!historySnap.length || PURE_ELABORATION_RE.test(q)) return q;
    const wordCount = q.split(/\s+/).length;
    if (wordCount <= 6 || FOLLOWUP_PREFIX_RE.test(q)) {
      for (let i = historySnap.length - 1; i >= 0; i--) {
        if (historySnap[i].role === 'user' && historySnap[i].text) {
          return `${historySnap[i].text} ${q}`;
        }
      }
    }
    return q;
  }

  // Unified Fallback Text Builder (when Cloudflare AI is offline or before deploy)
  function buildFallbackProse(data) {
    if (data.ai_generated) return data.ai_generated;
    const parts = [];
    if (data.direct_answer) parts.push(data.direct_answer);
    if (Array.isArray(data.explanation_paragraphs) && data.explanation_paragraphs.length) {
      parts.push(...data.explanation_paragraphs);
    }
    return parts.join('\n\n');
  }

  function renderUnifiedAnswer(data) {
    const wrap = document.createElement('article');
    wrap.className = 'msg-ai';

    const proseText = buildFallbackProse(data);
    const showStaticDalils =
      !data.ai_generated && Array.isArray(data.evidences) && data.evidences.length > 0 && !data.is_chat;

    let dalilHtml = '';
    if (showStaticDalils) {
      const items = data.evidences
        .slice(0, 3)
        .map((ev) => `<li>${formatRichText(ev.text)}</li>`)
        .join('');
      dalilHtml = `
        <div class="dalil-box" data-static-dalil>
          <div class="dalil-heading">📖 কুরআন ও সহীহ হাদীসের দলিল</div>
          <ul class="dalil-list">${items}</ul>
        </div>`;
    }

    // Verified DAWAH X Reference Chips
    const refItems = [];
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      for (const s of data.sources.slice(0, 4)) {
        const cleanTitle = s.clean_title || s.title || 'মূল লেখা';
        refItems.push(`
          <button type="button" class="ref-chip" data-read-key="${escHtml(s.key)}" title="${escHtml(cleanTitle)} (${escHtml(s.source_name || 'DAWAH X')})">
            <span class="ref-num">[${toBnNum(s.rank)}]</span>
            <span class="ref-title">${escHtml(cleanTitle.slice(0, 58))}${cleanTitle.length > 58 ? '…' : ''}</span>
          </button>`);
      }
    }
    if (Array.isArray(data.videos) && data.videos.length > 0 && !data.is_chat) {
      for (const v of data.videos.slice(0, 2)) {
        if (!v.video_id) continue;
        refItems.push(`
          <button type="button" class="ref-chip video-chip" data-play-video="${escHtml(v.video_id)}" data-video-title="${escHtml(v.title)}">
            <span class="ref-num">▶</span>
            <span class="ref-title">${escHtml((v.title || '').slice(0, 52))}${(v.title || '').length > 52 ? '…' : ''}</span>
          </button>`);
      }
    }

    const refsHtml = refItems.length
      ? `<div class="refs-block">
           <div class="refs-label">দলিল ও মূল তথ্যসূত্র (পড়তে ক্লিক করুন):</div>
           <div class="refs-list">${refItems.join('')}</div>
         </div>`
      : '';

    const askScholarHtml =
      data.status === 'not_found'
        ? `<div><a href="${escHtml(data.ask_team_url || 'https://ebrahim-ead.github.io/DAWAH-X/ask.html')}" target="_blank" rel="noopener noreferrer" class="src-action-btn gold-link" style="display:inline-flex;">✉ আলেম প্যানেলে প্রশ্নটি পাঠান ↗</a></div>`
        : '';

    const followUps = (data.follow_ups || []).slice(0, 3);
    const followHtml = followUps.length
      ? `<div class="followups-row">${followUps
          .map((fq) => `<button type="button" class="followup-chip" data-q="${escHtml(fq)}">${escHtml(fq)}</button>`)
          .join('')}</div>`
      : '';

    const srcUrlSuffix = data.sources?.[0]?.dawahx_url ? `\n\nসূত্র: ${data.sources[0].dawahx_url}` : '';
    const copyPayload = `${proseText}${srcUrlSuffix}`;

    wrap.innerHTML = `
      <div class="ai-avatar">
        <img src="logo-icon.webp" alt="DAWAH X AI" />
      </div>
      <div class="ai-body">
        <div class="ai-prose" data-prose-slot>${formatRichText(proseText)}</div>
        ${dalilHtml}
        ${askScholarHtml}
        ${refsHtml}
        ${followHtml}
        <div class="answer-actions">
          <button type="button" class="act-btn" data-copy-text="${escHtml(copyPayload)}">📋 কপি</button>
          <button type="button" class="act-btn" data-speak-text="${escHtml(proseText)}">🔊 শুনুন</button>
        </div>
      </div>
    `;
    return wrap;
  }

  async function streamLiveAI(question, data, aiNode, historySnap) {
    if (!cfAiAvailable || !aiNode) return;
    const proseSlot = aiNode.querySelector('[data-prose-slot]');
    if (!proseSlot) return;

    const hasRag = Array.isArray(data.rag_context) && data.rag_context.length > 0;
    const isElaboration = PURE_ELABORATION_RE.test(question.trim());
    const mode =
      data.status === 'not_found'
        ? 'not_found_islamic'
        : hasRag && !data.is_chat && !isElaboration
          ? 'grounded'
          : 'chat';

    const fallbackHtml = proseSlot.innerHTML;
    proseSlot.innerHTML = `<span class="stream-cursor"></span>`;

    const aiUrl = cfAiEndpointBase ? `${cfAiEndpointBase}/api/ai` : 'api/ai';

    try {
      const res = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          mode,
          stream: true,
          history: historySnap.slice(-8),
          rag_context: hasRag ? data.rag_context.slice(0, 4) : [],
          evidences: Array.isArray(data.evidences) ? data.evidences.slice(0, 4) : [],
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let fullText = '';
      let rafPending = false;
      let removedStaticDalil = false;

      const flushUI = (doneNow) => {
        rafPending = false;
        if (!fullText && !doneNow) return;
        if (!removedStaticDalil && fullText.length > 40) {
          removedStaticDalil = true;
          aiNode.querySelector('[data-static-dalil]')?.remove();
        }
        proseSlot.innerHTML =
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
              if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(() => flushUI(false));
              }
            }
          } catch (_) {}
        }
      }

      const cleaned = fullText.trim();
      if (cleaned) {
        flushUI(true);
        data.ai_generated = cleaned;

        for (let i = chatHistory.length - 1; i >= 0; i--) {
          if (chatHistory[i].role === 'assistant') {
            chatHistory[i].text = cleaned.slice(0, 1200);
            break;
          }
        }
        persistCurrentSession();

        const srcUrlSuffix = data.sources?.[0]?.dawahx_url ? `\n\nসূত্র: ${data.sources[0].dawahx_url}` : '';
        aiNode.querySelector('[data-copy-text]')?.setAttribute('data-copy-text', `${cleaned}${srcUrlSuffix}`);
        aiNode.querySelector('[data-speak-text]')?.setAttribute('data-speak-text', cleaned);
      } else {
        proseSlot.innerHTML = fallbackHtml;
      }
    } catch (_) {
      proseSlot.innerHTML = fallbackHtml;
    }
  }

  async function submitQuestion(rawQuestion) {
    const question = String(rawQuestion || '').trim();
    if (!question || isAsking) return;
    isAsking = true;
    sendBtn.disabled = true;
    suggestDropdown.style.display = 'none';
    welcomeHero.style.display = 'none';

    const userBubble = document.createElement('div');
    userBubble.className = 'msg-user';
    userBubble.textContent = question;
    chatContainer.appendChild(userBubble);

    const loader = document.createElement('div');
    loader.className = 'thinking-row';
    loader.innerHTML = `<div class="spinner"></div><span>দলিল অনুসন্ধান ও উত্তর প্রস্তুত হচ্ছে...</span>`;
    chatContainer.appendChild(loader);
    chatScroll.scrollTop = chatScroll.scrollHeight;

    const historySnapshot = chatHistory.slice(-10);
    const retrievalQuery = buildRetrievalQuery(question, historySnapshot);

    try {
      let data = null;
      if (backendAvailable === true) {
        try {
          const res = await fetch('api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: retrievalQuery,
              source_filter: 'all',
              top_k: 5,
              history: historySnapshot,
            }),
          });
          if (res.ok) data = await res.json();
        } catch (_) {}
      }
      if (!data && window.DawahXBrowserAI) {
        data = await window.DawahXBrowserAI.ask(retrievalQuery, 'all', 5, historySnapshot);
      }
      if (!data) throw new Error('Unavailable');

      chatHistory.push({ role: 'user', text: question });
      chatHistory.push({
        role: 'assistant',
        text: data.direct_answer || '',
        primary_title: data.headline || '',
        extra_body: data.extra_body || '',
        evidences: data.evidences || [],
        sources: data.sources || [],
      });
      if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);

      currentSessionTurns.push({ question, data });
      persistCurrentSession();

      loader.remove();
      const aiNode = renderUnifiedAnswer(data);
      chatContainer.appendChild(aiNode);
      aiNode.scrollIntoView({ behavior: 'smooth', block: 'start' });

      await streamLiveAI(question, data, aiNode, historySnapshot);
    } catch (_) {
      loader.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'msg-ai';
      errDiv.innerHTML = `<div class="ai-body"><div class="ai-prose"><p style="color:#f87171;">দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p></div></div>`;
      chatContainer.appendChild(errDiv);
    } finally {
      isAsking = false;
      sendBtn.disabled = false;
    }
  }

  // Composer Input, Typeahead Suggestions & Enter Submit
  let suggestTimer = null;
  questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';

    const val = questionInput.value.trim();
    clearTimeout(suggestTimer);
    if (val.length < 3 || !window.DawahXBrowserAI?.suggest) {
      suggestDropdown.style.display = 'none';
      return;
    }
    suggestTimer = setTimeout(async () => {
      try {
        const items = await window.DawahXBrowserAI.suggest(val, 4);
        if (!items || !items.length || document.activeElement !== questionInput) {
          suggestDropdown.style.display = 'none';
          return;
        }
        suggestDropdown.innerHTML = items
          .map(
            (it) =>
              `<button type="button" class="suggest-item" data-suggest-q="${escHtml(it.title)}">${escHtml(it.title)}</button>`
          )
          .join('');
        suggestDropdown.style.display = 'block';
      } catch (_) {
        suggestDropdown.style.display = 'none';
      }
    }, 180);
  });

  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askForm.requestSubmit();
    }
  });

  suggestDropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest-q]');
    if (!btn) return;
    const q = btn.getAttribute('data-suggest-q');
    suggestDropdown.style.display = 'none';
    questionInput.value = '';
    questionInput.style.height = 'auto';
    submitQuestion(q);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.composer-inner')) {
      suggestDropdown.style.display = 'none';
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

  // Delegated Clicks inside Q&A Stream (Starter Questions, Follow-ups, Citations, Copy, TTS)
  chatContainer.addEventListener('click', (e) => {
    const qBtn = e.target.closest('[data-q]');
    if (qBtn) {
      submitQuestion(qBtn.getAttribute('data-q'));
      return;
    }
    const readBtn = e.target.closest('[data-read-key]');
    if (readBtn) {
      openSourceReader(readBtn.getAttribute('data-read-key'));
      return;
    }
    const vidBtn = e.target.closest('[data-play-video]');
    if (vidBtn) {
      const vid = vidBtn.getAttribute('data-play-video');
      const title = vidBtn.getAttribute('data-video-title') || 'ভিডিও আলোচনা';
      if (vid && videoModal && videoIframe) {
        document.getElementById('videoModalTitle').textContent = title;
        videoIframe.src = `https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1`;
        videoModal.classList.add('open');
        backdrop.classList.add('open');
      }
      return;
    }
    const copyBtn = e.target.closest('[data-copy-text]');
    if (copyBtn) {
      navigator.clipboard
        .writeText(copyBtn.getAttribute('data-copy-text') || '')
        .then(() => showToast('✓ উত্তর কপি হয়েছে'));
      return;
    }
    const speakBtn = e.target.closest('[data-speak-text]');
    if (speakBtn) {
      toggleSpeak(speakBtn, speakBtn.getAttribute('data-speak-text') || '');
    }
  });

  // Scroll-to-Bottom Pill
  chatScroll?.addEventListener('scroll', () => {
    if (!scrollBottomBtn) return;
    const dist = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
    scrollBottomBtn.style.display = dist > 260 ? 'block' : 'none';
  });
  scrollBottomBtn?.addEventListener('click', () => {
    chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
  });

  // Full Original Source Reader Drawer
  async function openSourceReader(key) {
    if (!key) return;
    readerDrawer.classList.add('open');
    backdrop.classList.add('open');
    const titleEl = document.getElementById('drawerTitle');
    const metaEl = document.getElementById('drawerMeta');
    const contentEl = document.getElementById('drawerContent');
    const extUrlEl = document.getElementById('drawerExternalUrl');
    if (readerProgressBar) readerProgressBar.style.width = '0%';

    titleEl.textContent = 'মূল লেখা লোড হচ্ছে...';
    metaEl.textContent = '';
    contentEl.innerHTML = '<div class="spinner"></div>';
    extUrlEl.href = `https://ebrahim-ead.github.io/DAWAH-X/read.html?k=${encodeURIComponent(key)}`;

    try {
      let doc = null;
      if (backendAvailable === true) {
        try {
          const r = await fetch(`api/document/${encodeURIComponent(key)}`);
          if (r.ok) doc = await r.json();
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

      contentEl.innerHTML = String(doc.raw_html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    } catch (_) {
      titleEl.textContent = 'লেখাটি লোড করা যায়নি';
      contentEl.innerHTML = `<p>সরাসরি পড়তে <a href="https://ebrahim-ead.github.io/DAWAH-X/read.html?k=${encodeURIComponent(key)}" target="_blank" style="color:var(--gold)">DAWAH X সাইটে যান ↗</a></p>`;
    }
  }

  drawerBody?.addEventListener('scroll', () => {
    if (!readerProgressBar) return;
    const max = drawerBody.scrollHeight - drawerBody.clientHeight;
    readerProgressBar.style.width = (max > 10 ? Math.min(100, Math.round((drawerBody.scrollTop / max) * 100)) : 100) + '%';
  });

  // Bangla Voice Input (Speech-to-Text)
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
    recognition.onerror = recognition.onend;
  } else if (voiceBtn) {
    voiceBtn.style.display = 'none';
  }

  // PWA Offline Service Worker
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Initialize
  renderHistoryList();
  detectEngines().then(() => {
    const urlQ = new URLSearchParams(location.search).get('q');
    if (urlQ && urlQ.trim()) {
      submitQuestion(urlQ.trim());
    }
  });
})();
