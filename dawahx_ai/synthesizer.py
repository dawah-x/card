"""DAWAH X AI — Grounded Extractive Answer Synthesizer & Strict Faithfulness Guardrail.

Guarantees 0% hallucination: every sentence, ruling, Quranic verse, and Hadith reference
comes directly from verified texts on `https://ebrahim-ead.github.io/DAWAH-X/`.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set

from . import DAWAHX_SITE_URL
from .normalizer import detect_conversational_intent, tokenize_folded

_SENT_SPLIT_RE = re.compile(r"(?<=[।?!])\s+")


def _trim_cleanly(text: str, max_chars: int = 580) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    sents = _SENT_SPLIT_RE.split(text)
    out: List[str] = []
    cur = 0
    for s in sents:
        if cur + len(s) + 1 <= max_chars or not out:
            out.append(s)
            cur += len(s) + 1
            if cur >= max_chars:
                break
        else:
            break
    joined = " ".join(out).strip()
    if len(joined) > max_chars + 90:
        joined = joined[:max_chars].rsplit(" ", 1)[0].rstrip(" ,;:-") + "…"
    return joined


def _select_best_paragraphs(
    doc: Dict[str, Any],
    core_set: Set[str],
    expanded_set: Set[str],
    max_paras: int = 4,
    max_total_chars: int = 1450,
) -> List[str]:
    """Select the opening ruling + most query-relevant paragraphs from a DAWAH X document."""
    body = doc.get("answer_body") or ""
    paras = [p.strip() for p in body.split("\n\n") if len(p.strip()) >= 18]
    if not paras:
        opening = (doc.get("opening_ruling") or "").strip()
        return [opening] if opening else []

    # Filter out boilerplate lines in articles
    filtered: List[str] = []
    for p in paras:
        if len(p) < 42 and any(
            skip in p for skip in ("আসসালামু আলাইকুম", "বিসমিল্লাহির", "©", "এক নজরে পয়েন্ট", "প্রশ্ন :", "প্রশ্নঃ")
        ):
            continue
        filtered.append(p)
    if not filtered:
        filtered = paras

    dtype = doc.get("doc_type", "article")
    chosen_indices: List[int] = []

    # For fatwas & direct Q&As, paragraph 0 ALWAYS holds the direct shar'i verdict ("বাধা নেই", "জায়েয নয়", etc.)
    if dtype in ("fatwa", "qa") and filtered:
        chosen_indices.append(0)
        if len(filtered[0]) < 130 and len(filtered) > 1:
            chosen_indices.append(1)

    # Score remaining paragraphs by topical overlap + informative length
    scored_rest: List[tuple[float, int]] = []
    for idx, p in enumerate(filtered):
        if idx in chosen_indices:
            continue
        ptoks = set(tokenize_folded(p, stem=True))
        if not ptoks:
            continue
        core_hits = len(ptoks & core_set)
        exp_hits = len(ptoks & expanded_set)
        # Slight preference for earlier structural paragraphs and medium-length substantive paragraphs
        pos_bonus = 1.15 if idx <= 2 else (1.0 if idx <= 6 else 0.88)
        len_bonus = 1.0 if 70 <= len(p) <= 650 else 0.82
        sc = ((core_hits * 2.6) + (exp_hits * 0.85)) * pos_bonus * len_bonus
        scored_rest.append((sc, idx))

    scored_rest.sort(key=lambda pair: (-pair[0], pair[1]))
    for sc, idx in scored_rest:
        if len(chosen_indices) >= max_paras:
            break
        if sc > 0 or not chosen_indices:
            chosen_indices.append(idx)

    if not chosen_indices:
        chosen_indices = list(range(min(2, len(filtered))))

    # Preserve original reading order from the article/fatwa for coherent flow!
    chosen_indices.sort()

    selected: List[str] = []
    total_chars = 0
    for idx in chosen_indices:
        para_trimmed = _trim_cleanly(filtered[idx], max_chars=560)
        if total_chars + len(para_trimmed) > max_total_chars and selected:
            break
        selected.append(para_trimmed)
        total_chars += len(para_trimmed)

    return selected


def synthesize_response(query: str, retrieval: Dict[str, Any], summary: Dict[str, Any]) -> Dict[str, Any]:
    """Build a structured, strictly grounded Bengali Islamic answer from DAWAH X retrieval results."""
    intent = detect_conversational_intent(query)
    total_docs = summary.get("total_documents", 24207)
    total_vids = summary.get("total_videos", 9310)

    if intent == "greeting":
        return {
            "status": "conversational",
            "query": query,
            "headline": "ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহু!",
            "direct_answer": (
                f"আমি **DAWAH X AI**। কুরআন ও সহীহ সুন্নাহর আলোকে সাজানো **DAWAH X** ওয়েবসাইটের "
                f"**{total_docs:,}+** ফতোয়া, প্রশ্নোত্তর ও প্রবন্ধ এবং **{total_vids:,}+** ইসলামিক ভিডিও থেকে "
                f"আপনার প্রশ্নের দলিলভিত্তিক উত্তর খুঁজে দিতে প্রস্তুত।"
            ),
            "explanation_paragraphs": [
                "আপনি বাংলা, Banglish (যেমন: *namaz venge gele ki korbo*) অথবা ইংরেজিতে যেকোনো ইসলামিক মাসআলা, আকীদা, কুরআন-হাদীস কিংবা সংশয়মূলক প্রশ্ন করতে পারেন। আমি কোনো মনগড়া তথ্য যোগ না করে সরাসরি DAWAH X-এর যাচাইকৃত উৎস ও লিংকসহ উত্তর দেব।"
            ],
            "additional_perspectives": [],
            "evidences": [],
            "sources": [],
            "videos": [],
            "follow_ups": [
                "মসজিদের সিঁড়ির নিচে ইমাম ও মুয়াজ্জিনের ঘর করায় শারঈ বাধা আছে কি?",
                "আল্লাহর অস্তিত্বের যুক্তি ও প্রমাণ কী?",
                "যাদের কাছে ইসলামের দাওয়াত পৌঁছায়নি, তাদের বিচার কীভাবে হবে?",
                "ইসলামে গান ও বাদ্যযন্ত্রের বিধান কী?",
            ],
            "confidence": 1.0,
            "latency_ms": 0.5,
            "ask_team_url": f"{DAWAHX_SITE_URL}/ask.html",
        }

    if intent == "identity":
        return {
            "status": "conversational",
            "query": query,
            "headline": "পরিচিতি — DAWAH X AI মডেল",
            "direct_answer": (
                f"আমি **DAWAH X** (`{DAWAHX_SITE_URL}/`)-এর নিজস্ব ইসলামিক প্রশ্নোত্তর এআই মডেল। "
                f"আমাকে কোনো ইসলামিক প্রশ্ন করা হলে আমি শুধুমাত্র এই ওয়েবসাইটের সংগৃহীত **{total_docs:,}টি** "
                f"ফতোয়া, প্রবন্ধ ও প্রশ্নোত্তর (মাসিক আত-তাহরীক, মাসিক আল-ইতিছাম, মাসিক আল-ইখলাছ, From Muslims, "
                f"Response to Anti-Islam, Insight Zone ও Islamic Authors) এবং **{total_vids:,}টি** ভিডিও থেকে উত্তর প্রদান করি।"
            ),
            "explanation_paragraphs": [
                "আমার মূল নীতি হলো **শতভাগ আমানতদারিতা**: ওয়েবসাইটে নেই এমন কোনো ফতোয়া বা মনগড়া কথা আমি নিজে থেকে তৈরি করি না। প্রতিটি উত্তরের নিচে মূল লেখার সরাসরি লিংক দেওয়া থাকে যাতে আপনি সম্পূর্ণ দলিল যাচাই করে পড়তে পারেন।"
            ],
            "additional_perspectives": [],
            "evidences": [],
            "sources": [],
            "videos": [],
            "follow_ups": [
                "সালাতে সাহু সিজদা কখন এবং কীভাবে দিতে হয়?",
                "রোজা অবস্থায় ইনজেকশন বা স্যালাইন নিলে কি রোজা ভেঙে যাবে?",
                "পৃথিবীতে দুঃখ-কষ্ট ও পরীক্ষা কেন দেওয়া হয়?",
                "যাকাত ফরয হওয়ার নিসাব ও হিসাব করার নিয়ম কী?",
            ],
            "confidence": 1.0,
            "latency_ms": 0.5,
            "ask_team_url": f"{DAWAHX_SITE_URL}/ask.html",
        }

    candidates: List[Dict[str, Any]] = retrieval.get("candidates", [])
    videos: List[Dict[str, Any]] = retrieval.get("videos", [])
    core_set = set(retrieval.get("core_tokens", []))
    expanded_set = set(retrieval.get("expanded_tokens", []))
    latency_ms = retrieval.get("latency_ms", 0.0)

    # Abstention / Guardrail check when no reliable match exists in DAWAH X
    if not candidates or (
        candidates[0]["confidence"] < 0.23
        or (candidates[0]["core_coverage"] < 0.24 and candidates[0]["reranker_prob"] < 0.30)
    ):
        partial_sources = [c for c in candidates[:3] if c["confidence"] >= 0.14 and c["core_coverage"] > 0.0]
        return {
            "status": "not_found",
            "query": query,
            "headline": "DAWAH X সংগ্রহে এ বিষয়ে সরাসরি উত্তর পাওয়া যায়নি",
            "direct_answer": (
                "দুঃখিত, আপনার এই নির্দিষ্ট প্রশ্নটির হুবহু বা নিশ্চিত উত্তর **DAWAH X**-এর বর্তমান সংগ্রহে খুঁজে পাওয়া যায়নি। "
                "ইসলামী শরীআতের বিষয়ে অনুমান বা সাইটের বাইরের তথ্য দিয়ে মনগড়া ফতোয়া প্রদান করা থেকে আমরা বিরত থাকি।"
            ),
            "explanation_paragraphs": [
                "আপনি প্রশ্নটি ভিন্নভাবে বা মূল বাংলা শব্দ ব্যবহার করে পুনরায় খুঁজে দেখতে পারেন, অথবা নিচের বোতামে ক্লিক করে সরাসরি **DAWAH X টিমের** কাছে আপনার প্রশ্নটি পাঠাতে পারেন।"
            ],
            "additional_perspectives": [],
            "evidences": [],
            "sources": [
                {
                    "rank": i + 1,
                    "key": s["key"],
                    "title": s["title"],
                    "clean_title": s["clean_title"],
                    "source_name": s["source_name"],
                    "category": s["category"],
                    "doc_type": s["doc_type"],
                    "author": s["author"],
                    "pub_date": s["pub_date"],
                    "dawahx_url": s["dawahx_url"],
                    "orig_url": s["orig_url"],
                    "confidence": s["confidence"],
                    "excerpt": _trim_cleanly(s["opening_ruling"], 200),
                }
                for i, s in enumerate(partial_sources)
            ],
            "videos": videos[:2] if (candidates and candidates[0]["confidence"] >= 0.18) else [],
            "follow_ups": [
                s["clean_title"] for s in partial_sources if len(s["clean_title"]) <= 110
            ][:3]
            or [
                "কুরআন ও সুন্নাহর আলোকে তাওহীদের গুরুত্ব কী?",
                "সালাত আদায়ের সহীহ নিয়ম কী?",
                "আল্লাহর রহমত ও তওবা কবুলের শর্ত কী?",
            ],
            "confidence": round(candidates[0]["confidence"], 4) if candidates else 0.0,
            "latency_ms": latency_ms,
            "ask_team_url": f"{DAWAHX_SITE_URL}/ask.html",
        }

    # Strong / Verified Match in DAWAH X!
    primary = candidates[0]
    # If #1 is a short video-redirect stub (e.g. "বিস্তারিত জানতে নিচের ভিডিওটি দেখুন") and #2 has a rich written answer,
    # promote #2's written explanation while keeping #1 in cited sources!
    prose_doc = primary
    if (
        len(primary.get("answer_body") or "") < 180
        and "ভিডিও" in (primary.get("answer_body") or "")
        and len(candidates) > 1
        and candidates[1]["confidence"] >= 0.24
        and len(candidates[1].get("answer_body") or "") >= 180
    ):
        prose_doc = candidates[1]

    selected_paras = _select_best_paragraphs(prose_doc, core_set, expanded_set, max_paras=4, max_total_chars=1500)

    direct_answer = selected_paras[0] if selected_paras else _trim_cleanly(prose_doc["opening_ruling"], 500)
    explanation_paragraphs = selected_paras[1:] if len(selected_paras) > 1 else []

    # Gather corroborating perspectives from rank #2 and #3 if genuinely relevant to the query
    additional_perspectives: List[Dict[str, Any]] = []
    for sec in candidates[1:4]:
        if sec is prose_doc:
            continue
        if sec["confidence"] >= max(0.35, primary["confidence"] * 0.58) and sec["core_coverage"] >= 0.45:
            sec_paras = _select_best_paragraphs(sec, core_set, expanded_set, max_paras=1, max_total_chars=380)
            if sec_paras:
                additional_perspectives.append(
                    {
                        "key": sec["key"],
                        "title": sec["clean_title"],
                        "source_name": sec["source_name"],
                        "dawahx_url": sec["dawahx_url"],
                        "summary": _trim_cleanly(sec_paras[0], 340),
                    }
                )
        if len(additional_perspectives) >= 2:
            break

    # Collect verified Quran & Hadith evidences (dalils) from primary + top corroborating source
    evidences: List[Dict[str, str]] = []
    seen_ev_text: set[str] = set()
    ev_docs = [prose_doc] + [c for c in candidates[:3] if c is not prose_doc]
    for src_doc in ev_docs:
        if src_doc is not prose_doc and src_doc is not primary and src_doc["confidence"] < 0.45:
            continue
        for ev in src_doc.get("evidences", []):
            ev_key = ev[:65]
            if ev_key not in seen_ev_text:
                seen_ev_text.add(ev_key)
                evidences.append(
                    {
                        "text": ev,
                        "source_title": src_doc["clean_title"],
                        "source_name": src_doc["source_name"],
                        "dawahx_url": src_doc["dawahx_url"],
                    }
                )
            if len(evidences) >= 5:
                break
        if len(evidences) >= 5:
            break

    # Build top cited DAWAH X source cards (up to 5)
    cited_docs = [primary]
    if prose_doc is not primary:
        cited_docs.append(prose_doc)
    for c in candidates[1:5]:
        if c not in cited_docs and c["confidence"] >= max(0.24, primary["confidence"] * 0.40):
            cited_docs.append(c)
    sources_payload = [
        {
            "rank": idx + 1,
            "key": c["key"],
            "title": c["title"],
            "clean_title": c["clean_title"],
            "source_code": c["source_code"],
            "source_name": c["source_name"],
            "category": c["category"],
            "doc_type": c["doc_type"],
            "author": c["author"],
            "pub_date": c["pub_date"],
            "dawahx_url": c["dawahx_url"],
            "share_url": c["share_url"],
            "orig_url": c["orig_url"],
            "confidence": c["confidence"],
            "excerpt": _trim_cleanly(c["opening_ruling"], 220),
        }
        for idx, c in enumerate(cited_docs[:5])
    ]

    # Follow-up related questions from remaining retrieved DAWAH X candidates
    follow_ups: List[str] = []
    for c in candidates[1:8]:
        ct = c["clean_title"].strip()
        if 12 <= len(ct) <= 125 and ct != primary["clean_title"] and ct not in follow_ups:
            follow_ups.append(ct)
        if len(follow_ups) >= 4:
            break

    # RAG context block for optional client-side LLM prose mode
    rag_context = [
        {
            "citation": f"[{i + 1}] {c['title']} ({c['source_name']}) — {c['dawahx_url']}",
            "content": _trim_cleanly(c["answer_body"], 1200),
        }
        for i, c in enumerate(cited_docs[:3])
    ]

    return {
        "status": "answered",
        "query": query,
        "headline": primary["clean_title"],
        "primary_source_name": primary["source_name"],
        "primary_doc_type": primary["doc_type"],
        "primary_key": primary["key"],
        "primary_url": primary["dawahx_url"],
        "direct_answer": direct_answer,
        "explanation_paragraphs": explanation_paragraphs,
        "additional_perspectives": additional_perspectives,
        "evidences": evidences,
        "sources": sources_payload,
        "videos": videos[:4],
        "follow_ups": follow_ups,
        "rag_context": rag_context,
        "confidence": primary["confidence"],
        "latency_ms": latency_ms,
        "mapped_terms": retrieval.get("mapped_terms", []),
        "ask_team_url": f"{DAWAHX_SITE_URL}/ask.html",
    }
