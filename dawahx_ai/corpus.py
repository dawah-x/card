"""DAWAH X Corpus Loader, Structural Q&A Parser, Dalil Extractor & SQLite Store.

Ingests 100% of `https://ebrahim-ead.github.io/DAWAH-X/` (`Ebrahim-ead/DAWAH-X`):
- All 24,207+ Bengali Islamic texts (`texts/*.json`)
- All 9,310+ YouTube Islamic videos (`youtube-videos.json`)
- Curated starter topics (`tools/topics.json`) & source metadata (`source-index.json`, `stats.json`)
"""

from __future__ import annotations

import glob
import html as html_lib
import json
import os
import re
import sqlite3
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import DAWAHX_REPO_URL, DAWAHX_SITE_URL

SOURCE_NAMES: Dict[str, str] = {
    "at": "মাসিক আত-তাহরীক",
    "ai": "মাসিক আল-ইতিছাম",
    "ik": "মাসিক আল-ইখলাছ",
    "fm": "From Muslims",
    "ra": "Response to Anti-Islam",
    "iz": "Insight Zone",
    "ia": "Islamic Authors",
}

_COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")
_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[\s\S]*?</\1>", re.IGNORECASE)
_IK_SUBJECTS_RE = re.compile(
    r'<div class="subjects">\s*<span>প্রসঙ্গসমূহ »:\s*</span>'
    r'(?:\s*<a href="https://ikhlasbd\.com/subject_archive/\d+">[^<]*</a>)*\s*</div>\s*$',
    re.IGNORECASE,
)
_BLOCK_END_RE = re.compile(r"</(?:p|div|li|h[1-6]|blockquote|tr|section|article)>|<br\s*/?>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_INLINE_RE = re.compile(r"[ \t\r\f\v]+")
_MULTI_NL_RE = re.compile(r"\n\s*\n+")

# Question prefix numbering like "প্রশ্ন (২৬/১৪৬) :" or "প্রশ্ন ১০ :"
_Q_PREFIX_RE = re.compile(
    r"^\s*(?:প্রশ্ন|সওয়াল|জিজ্ঞাসা)\s*(?:\([^)]{1,25}\)|[০-৯0-9/.\-]+)?\s*[:ঃ\-–—]\s*",
    re.UNICODE,
)

# Split markers separating embedded Question/Allegation from Answer/Rebuttal
_HTML_QA_SPLIT_RE = re.compile(
    r"(?:<h[1-4][^>]*>\s*(?:অফিসিয়াল\s+)?(?:উত্তর|জবাব|পর্যালোচনা|খণ্ডন)\s*[:ঃ\-–—]?\s*</h[1-4]>|"
    r"<(?:b|strong)[^>]*>\s*(?:অফিসিয়াল\s+)?(?:উত্তর|জবাব|পর্যালোচনা|খণ্ডন)\s*[:ঃ\-–—]?\s*</(?:b|strong)>|"
    r"<span[^>]*font-weight\s*:\s*bold[^>]*>\s*(?:উত্তর|জবাব)\s*(?:&nbsp;|\s)*[:ঃ\-–—]?\s*(?:&nbsp;|\s)*</span>)",
    re.IGNORECASE,
)

_ANS_PREFIX_CLEAN_RE = re.compile(r"^\s*(?:উত্তর|জবাব)\s*[:ঃ\-–—]?\s*")

# Evidence / Dalil extraction patterns (Quranic surahs, Hadith collections, italicized citations)
_DALIL_KEYWORDS_RE = re.compile(
    r"(?:সূরা|সুরা|আল-কুরআন|কুরআন\s*[০-৯0-9]+:[০-৯0-9]+|"
    r"বুখারী|বুখারি|মুসলিম|আবূ?\s*দাঊদ|আবু\s*দাউদ|তিরমিযী|তিরমিজি|নাসাঈ|নাসাই|"
    r"ইবনু?\s*মাজাহ|মুসনাদে?\s*আহমাদ|মিশকাত|রিয়াদুস\s*সালেহীন|সিলসিলা\s*ছহীহাহ|সিলসিলা\s*সহীহাহ|"
    r"মুওয়াত্তা|দারাকুতনী|বায়হাকী|তাবারানী|হাকিম|ইবনু?\s*হিব্বান|ফাতহুল\s*বারী|"
    r"ফাতাওয়া\s*লাজনা|ইবনু?\s*তায়মিয়া|ইবনু?\s*কাসীর|বিন\s*বায|উছায়মীন|আলবানী)",
    re.UNICODE,
)
_ARABIC_CHUNK_RE = re.compile(r"[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u065F\u0670\uFD50-\uFDFF\uFE70-\uFEFF۝﴿﴾().,،؛:«»\-]{12,}")
_ITALIC_CITE_RE = re.compile(r"<(?:i|em)>([^<]{6,220})</(?:i|em)>", re.IGNORECASE)


def clean_source_html(raw_html: str, source_code: str) -> str:
    """Clean invisible comments & source-specific footer boilerplate without altering article content."""
    val = _COMMENT_RE.sub(" ", raw_html or "")
    val = _SCRIPT_STYLE_RE.sub(" ", val)
    if source_code == "ik":
        val = _IK_SUBJECTS_RE.sub(" ", val)
    return val.strip()


def html_to_paragraphs(raw_html: str) -> List[str]:
    """Convert article HTML into clean, readable paragraphs while preserving Arabic & Bengali punctuation."""
    if not raw_html:
        return []
    text = _BLOCK_END_RE.sub("\n", raw_html)
    text = _TAG_RE.sub(" ", text)
    text = html_lib.unescape(text)
    text = _WS_INLINE_RE.sub(" ", text)
    lines = [ln.strip() for ln in text.split("\n")]
    paras: List[str] = []
    for ln in lines:
        if not ln:
            continue
        # Merge stray single-word header labels like "উত্তর :" with next paragraph later if needed
        paras.append(ln)
    return paras


def parse_document_structure(
    title: str, raw_html: str, source_code: str
) -> Tuple[str, str, str, str, str, List[str]]:
    """Parse a DAWAH X document into:
    (doc_type, clean_title, question_context, answer_body, opening_ruling, evidences)
    """
    cleaned_html = clean_source_html(raw_html, source_code)
    clean_title = _Q_PREFIX_RE.sub("", (title or "").strip()).strip()
    is_titled_question = bool(_Q_PREFIX_RE.match(title or "")) or ("?" in (title or ""))

    question_context = ""
    answer_html = cleaned_html

    # Check if HTML splits into embedded Question/Allegation vs Answer/Rebuttal
    split_match = _HTML_QA_SPLIT_RE.search(cleaned_html)
    if split_match:
        pre_html = cleaned_html[: split_match.start()]
        post_html = cleaned_html[split_match.end() :]
        pre_paras = html_to_paragraphs(pre_html)
        post_paras = html_to_paragraphs(post_html)
        if post_paras:
            # Remove header words like "প্রশ্ন" / "অভিযোগঃ"
            q_lines = [
                p for p in pre_paras
                if p not in ("প্রশ্ন", "প্রশ্ন:", "প্রশ্নঃ", "অভিযোগ", "অভিযোগ:", "অভিযোগঃ")
                and not p.startswith("— ")
            ]
            question_context = " ".join(q_lines)[:1200].strip()
            answer_html = post_html

    ans_paras = html_to_paragraphs(answer_html)
    # Clean leading "উত্তর :" prefix if still attached to first paragraph
    if ans_paras:
        ans_paras[0] = _ANS_PREFIX_CLEAN_RE.sub("", ans_paras[0]).strip()
        ans_paras = [p for p in ans_paras if p]

    # Determine doc_type
    if split_match or is_titled_question:
        if source_code in ("ra", "fm", "iz", "ia") and not _Q_PREFIX_RE.match(title or ""):
            doc_type = "rebuttal" if ("অভিযোগ" in cleaned_html[:350] or source_code == "ra") else "qa"
        else:
            doc_type = "fatwa" if source_code in ("at", "ai", "ik") else "qa"
    else:
        doc_type = "rebuttal" if source_code in ("ra", "fm", "iz", "ia") else "article"

    # Extract opening ruling (first 1-2 substantive paragraphs up to ~550 chars)
    opening_parts: List[str] = []
    char_count = 0
    for p in ans_paras:
        # Skip boilerplate greetings/bismillah/copyright lines in articles
        if len(p) < 40 and any(
            skip in p for skip in ("আসসালামু আলাইকুম", "বিসমিল্লাহির", "©", "এক নজরে পয়েন্ট")
        ):
            continue
        opening_parts.append(p)
        char_count += len(p)
        if char_count >= 380 or len(opening_parts) >= 2:
            break
    opening_ruling = "\n\n".join(opening_parts).strip()
    answer_body = "\n\n".join(ans_paras).strip()

    # Extract Quranic & Hadith Evidences (Dalils) from the answer
    evidences: List[str] = []
    seen_ev: set[str] = set()

    # 1) Paragraphs/sentences containing explicit Quran/Hadith references or Arabic ayahs/hadiths
    for p in ans_paras:
        has_dalil_kw = bool(_DALIL_KEYWORDS_RE.search(p))
        has_arabic = bool(_ARABIC_CHUNK_RE.search(p))
        if has_dalil_kw or has_arabic:
            # Extract clean sentence/snippet around the evidence (max ~360 chars)
            snippet = p.strip()
            if len(snippet) > 420:
                # Split on Bengali danda '।' or period and keep sentences mentioning dalil/Arabic
                sents = re.split(r"(?<=[।?!])\s+", snippet)
                rel_sents = [
                    s.strip() for s in sents
                    if _DALIL_KEYWORDS_RE.search(s) or _ARABIC_CHUNK_RE.search(s)
                ]
                if rel_sents:
                    snippet = " ".join(rel_sents[:2])
                if len(snippet) > 420:
                    snippet = snippet[:417].rsplit(" ", 1)[0] + "…"
            norm_key = snippet[:80]
            if len(snippet) >= 18 and norm_key not in seen_ev:
                seen_ev.add(norm_key)
                evidences.append(snippet)
            if len(evidences) >= 5:
                break

    # 2) Also check italicized citations <i>(বুখারী হা/...)</i> if not already captured
    if len(evidences) < 5:
        for m in _ITALIC_CITE_RE.finditer(answer_html):
            cite = html_lib.unescape(_WS_INLINE_RE.sub(" ", m.group(1))).strip(" ()")
            if len(cite) >= 8 and _DALIL_KEYWORDS_RE.search(cite):
                norm_key = cite[:60]
                if norm_key not in seen_ev and not any(cite in ev for ev in evidences):
                    seen_ev.add(norm_key)
                    evidences.append(f"তথ্যসূত্র: {cite}")
                if len(evidences) >= 5:
                    break

    return doc_type, clean_title, question_context, answer_body, opening_ruling, evidences


def ensure_dawahx_repo(repo_dir: Path, pull_updates: bool = False) -> Dict[str, Any]:
    """Ensure local clone of Ebrahim-ead/DAWAH-X exists in `.cache/dawah-x-repo`."""
    repo_dir.parent.mkdir(parents=True, exist_ok=True)
    if not (repo_dir / "texts").is_dir():
        subprocess.run(
            ["git", "clone", "--depth", "1", DAWAHX_REPO_URL, str(repo_dir)],
            check=True,
            capture_output=True,
            text=True,
            timeout=180,
        )
        action = "cloned"
    elif pull_updates:
        subprocess.run(
            ["git", "-C", str(repo_dir), "pull", "--ff-only"],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        action = "pulled"
    else:
        action = "cached"

    commit_sha = subprocess.run(
        ["git", "-C", str(repo_dir), "rev-parse", "--short", "HEAD"],
        check=False,
        capture_output=True,
        text=True,
    ).stdout.strip()

    stats_path = repo_dir / "stats.json"
    stats = json.loads(stats_path.read_text(encoding="utf-8")) if stats_path.exists() else {}
    return {"action": action, "commit": commit_sha, "stats": stats}


def build_sqlite_corpus(repo_dir: Path, db_path: Path) -> Dict[str, Any]:
    """Parse all DAWAH X texts, videos & topics into an indexed SQLite database."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_db = db_path.with_suffix(".tmp.db")
    if tmp_db.exists():
        tmp_db.unlink()

    conn = sqlite3.connect(str(tmp_db))
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")

    conn.executescript(
        """
        CREATE TABLE documents (
            doc_id INTEGER PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            source_code TEXT NOT NULL,
            source_name TEXT NOT NULL,
            category TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            title TEXT NOT NULL,
            clean_title TEXT NOT NULL,
            question_context TEXT NOT NULL,
            opening_ruling TEXT NOT NULL,
            answer_body TEXT NOT NULL,
            raw_html TEXT NOT NULL,
            evidences_json TEXT NOT NULL,
            author TEXT NOT NULL,
            pub_date TEXT NOT NULL,
            orig_url TEXT NOT NULL,
            topic_id TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_documents_key ON documents(key);
        CREATE INDEX idx_documents_type ON documents(doc_type);
        CREATE INDEX idx_documents_source ON documents(source_code);

        CREATE TABLE videos (
            vid_idx INTEGER PRIMARY KEY,
            video_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            channel_title TEXT NOT NULL,
            published_at TEXT NOT NULL
        );

        CREATE TABLE topics (
            topic_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            intro TEXT NOT NULL,
            keys_json TEXT NOT NULL
        );

        CREATE TABLE metadata (
            k TEXT PRIMARY KEY,
            v TEXT NOT NULL
        );
        """
    )

    # Load curated topics first so flagship topic keys get tagged
    key_to_topic: Dict[str, str] = {}
    topics_file = repo_dir / "tools" / "topics.json"
    topics_list: List[Dict[str, Any]] = []
    if topics_file.exists():
        tdata = json.loads(topics_file.read_text(encoding="utf-8"))
        for tp in tdata.get("topics", []):
            tid = tp["id"]
            topics_list.append(tp)
            for k in tp.get("keys", []):
                key_to_topic[k] = tid
            conn.execute(
                "INSERT INTO topics (topic_id, title, intro, keys_json) VALUES (?, ?, ?, ?)",
                (tid, tp.get("title", ""), tp.get("intro", ""), json.dumps(tp.get("keys", []), ensure_ascii=False)),
            )

    # Read all text buckets (texts/000.json .. texts/fff.json)
    bucket_files = sorted(
        f for f in glob.glob(str(repo_dir / "texts" / "*.json"))
        if re.search(r"/[0-9a-f]{3}\.json$", f)
    )

    raw_items: List[Tuple[str, Dict[str, Any]]] = []
    for bf in bucket_files:
        with open(bf, "r", encoding="utf-8") as fp:
            bdata = json.load(fp)
            for k, item in bdata.items():
                raw_items.append((k, item))

    # Deterministic order by key (identical to DAWAH X's `docs.sort((a,b)=>a.k<b.k?-1:1)`)
    raw_items.sort(key=lambda pair: pair[0])

    doc_rows = []
    type_counts: Dict[str, int] = {}
    source_counts: Dict[str, int] = {}

    for doc_id, (k, x) in enumerate(raw_items):
        s_code = str(x.get("s") or "")
        s_name = SOURCE_NAMES.get(s_code, s_code)
        cat = str(x.get("c") or s_name).strip()
        title = re.sub(r"\s+", " ", str(x.get("t") or "")).strip()
        raw_h = str(x.get("h") or "")
        author = str(x.get("a") or "").strip()
        pub_date = str(x.get("d") or "").strip()
        orig_url = str(x.get("u") or "").strip()
        if not orig_url.startswith(("http://", "https://")):
            orig_url = ""

        doc_type, clean_title, q_ctx, ans_body, opening_ruling, evidences = parse_document_structure(
            title, raw_h, s_code
        )
        type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        source_counts[s_code] = source_counts.get(s_code, 0) + 1

        doc_rows.append(
            (
                doc_id,
                k,
                s_code,
                s_name,
                cat,
                doc_type,
                title,
                clean_title,
                q_ctx,
                opening_ruling,
                ans_body,
                clean_source_html(raw_h, s_code),
                json.dumps(evidences, ensure_ascii=False),
                author,
                pub_date,
                orig_url,
                key_to_topic.get(k, ""),
            )
        )

    conn.executemany(
        """
        INSERT INTO documents (
            doc_id, key, source_code, source_name, category, doc_type,
            title, clean_title, question_context, opening_ruling, answer_body,
            raw_html, evidences_json, author, pub_date, orig_url, topic_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        doc_rows,
    )

    # Load YouTube videos (`youtube-videos.json`)
    yt_file = repo_dir / "youtube-videos.json"
    video_rows = []
    if yt_file.exists():
        yt_data = json.loads(yt_file.read_text(encoding="utf-8"))
        seen_vids: set[str] = set()
        for v in yt_data:
            vid = str(v.get("id") or "").strip()
            vtitle = str(v.get("title") or "").strip()
            if not vid or not vtitle or vid in seen_vids:
                continue
            seen_vids.add(vid)
            video_rows.append(
                (
                    len(video_rows),
                    vid,
                    vtitle,
                    str(v.get("channelTitle") or "").strip(),
                    str(v.get("publishedAt") or "").strip(),
                )
            )
        conn.executemany(
            "INSERT INTO videos (vid_idx, video_id, title, channel_title, published_at) VALUES (?, ?, ?, ?, ?)",
            video_rows,
        )

    stats_file = repo_dir / "stats.json"
    site_stats = json.loads(stats_file.read_text(encoding="utf-8")) if stats_file.exists() else {}
    summary = {
        "site_url": DAWAHX_SITE_URL,
        "total_documents": len(doc_rows),
        "total_videos": len(video_rows),
        "total_topics": len(topics_list),
        "type_counts": type_counts,
        "source_counts": source_counts,
        "source_names": SOURCE_NAMES,
        "site_stats": site_stats,
    }
    conn.execute("INSERT INTO metadata (k, v) VALUES ('summary', ?)", (json.dumps(summary, ensure_ascii=False),))
    conn.commit()
    conn.close()

    if db_path.exists():
        db_path.unlink()
    tmp_db.rename(db_path)
    return summary
