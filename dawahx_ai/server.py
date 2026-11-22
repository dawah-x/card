"""FastAPI Server for DAWAH X AI — Grounded Islamic Question Answering Model."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import DAWAHX_SITE_URL, __version__
from .dialogue import augment_query_with_history, handle_dialogue_turn
from .model import DawahXAIModel
from .synthesizer import synthesize_response

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / ".cache"

ai_model = DawahXAIModel(CACHE_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ai_model.load_or_train(force_retrain=False, pull_updates=False)
    yield


app = FastAPI(
    title="DAWAH X AI — ইসলামিক প্রশ্নোত্তর এআই মডেল",
    description=f"Grounded Islamic Question Answering AI powered strictly by {DAWAHX_SITE_URL}/",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200, description="Message or Islamic question")
    source_filter: str = Field(default="all", description="all | fatwa | dawah | article | at | ai | ik | fm | ra | iz | ia")
    top_k: int = Field(default=5, ge=1, le=10)
    history: Optional[list[Dict[str, Any]]] = Field(default=None, description="Recent conversation turns for multi-turn context")


class SyncRequest(BaseModel):
    force_retrain: bool = False


@app.get("/api/health")
def api_health() -> Dict[str, Any]:
    return {
        "ok": True,
        "ready": ai_model.ready,
        "version": __version__,
        "site_url": DAWAHX_SITE_URL,
        "documents": ai_model.summary.get("total_documents", 0),
        "videos": ai_model.summary.get("total_videos", 0),
        "metrics": ai_model.metrics,
    }


@app.get("/api/stats")
def api_stats() -> Dict[str, Any]:
    if not ai_model.ready:
        ai_model.load_or_train()
    return {
        "version": __version__,
        "site_url": DAWAHX_SITE_URL,
        "summary": ai_model.summary,
        "metrics": ai_model.metrics,
        "topics": ai_model.get_topics(),
    }


@app.get("/api/topics")
def api_topics() -> Dict[str, Any]:
    if not ai_model.ready:
        ai_model.load_or_train()
    return {"topics": ai_model.get_topics()}


@app.post("/api/ask")
def api_ask_post(req: AskRequest) -> Dict[str, Any]:
    q = req.question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="প্রশ্নটি লিখুন।")
    chat_resp = handle_dialogue_turn(q, ai_model.summary, history=req.history)
    if chat_resp is not None:
        return chat_resp
    aug_q, used_hist = augment_query_with_history(q, history=req.history)
    retrieval = ai_model.retrieve(aug_q, top_k=req.top_k, source_filter=req.source_filter)
    return synthesize_response(q, retrieval, ai_model.summary, history=req.history, used_history=used_hist)


@app.get("/api/ask")
def api_ask_get(
    q: str = Query(..., min_length=1, max_length=1200),
    source_filter: str = Query(default="all"),
    top_k: int = Query(default=5, ge=1, le=10),
) -> Dict[str, Any]:
    retrieval = ai_model.retrieve(q.strip(), top_k=top_k, source_filter=source_filter)
    return synthesize_response(q.strip(), retrieval, ai_model.summary)


@app.get("/api/document/{key}")
def api_document(key: str) -> Dict[str, Any]:
    if not key or len(key) > 32 or not key.isalnum():
        raise HTTPException(status_code=400, detail="অবৈধ লেখার চাবি।")
    doc = ai_model.get_document_by_key(key)
    if not doc:
        raise HTTPException(status_code=404, detail="লেখাটি খুঁজে পাওয়া যায়নি।")
    return doc


@app.post("/api/sync")
def api_sync(req: Optional[SyncRequest] = None) -> Dict[str, Any]:
    force = bool(req.force_retrain) if req else False
    old_commit = ai_model.metrics.get("source_commit", "")
    result = ai_model.load_or_train(force_retrain=force, pull_updates=True)
    new_commit = result.get("repo", {}).get("commit", "")
    if new_commit != old_commit or force:
        result = ai_model.train(repo_status=result.get("repo"), rebuild_db=True)
    return {
        "ok": True,
        "previous_commit": old_commit,
        "current_commit": ai_model.metrics.get("source_commit", ""),
        "updated": new_commit != old_commit or force,
        "summary": ai_model.summary,
        "metrics": ai_model.metrics,
    }


@app.get("/styles.css")
def serve_styles_css():
    return FileResponse(str(ROOT_DIR / "styles.css"), media_type="text/css; charset=utf-8")


@app.get("/browser-ai.js")
def serve_browser_ai_js():
    return FileResponse(str(ROOT_DIR / "browser-ai.js"), media_type="application/javascript; charset=utf-8")


@app.get("/app.js")
def serve_app_js():
    return FileResponse(str(ROOT_DIR / "app.js"), media_type="application/javascript; charset=utf-8")


@app.get("/dawahx-ai-widget.js")
def serve_widget_js():
    return FileResponse(
        str(ROOT_DIR / "dawahx-ai-widget.js"),
        media_type="application/javascript; charset=utf-8",
        headers={"Cache-Control": "no-cache"},
    )


app.mount("/fonts", StaticFiles(directory=str(ROOT_DIR / "fonts")), name="fonts")


@app.get("/favicon.svg")
def serve_favicon():
    return FileResponse(str(ROOT_DIR / "favicon.svg"), media_type="image/svg+xml")


@app.get("/logo.webp")
def serve_logo():
    return FileResponse(str(ROOT_DIR / "logo.webp"), media_type="image/webp")


@app.get("/logo-icon.webp")
def serve_logo_icon():
    return FileResponse(str(ROOT_DIR / "logo-icon.webp"), media_type="image/webp")


@app.get("/")
def serve_index():
    return FileResponse(str(ROOT_DIR / "index.html"), media_type="text/html; charset=utf-8")
