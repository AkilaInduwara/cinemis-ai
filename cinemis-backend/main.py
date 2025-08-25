# main.py

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss, pickle, numpy as np
import os, tempfile, subprocess, requests
from typing import Tuple, Dict, Any, List

# ---- NEW: subtitle matching + tmdb enricher ----
from sub_matcher import SubtitleMatcher
from tmdb_enrich import TMDBEnricher

# Load FAISS index and metadata (TMDB overview index)
index = faiss.read_index("movie_index.faiss")
with open("metadata.pkl", "rb") as f:
    metadata = pickle.load(f)

# Load model for TMDB overview search
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

# ---- NEW: subtitle FAISS + enricher ----
sub_matcher = None
tmdb_enricher = None
try:
    sub_matcher = SubtitleMatcher()
    print("✅ SubtitleMatcher loaded")
except Exception as e:
    print("⚠️ Subtitle matcher not loaded:", e)

try:
    tmdb_enricher = TMDBEnricher()
    print(f"✅ TMDB enricher: {len(tmdb_enricher.items)} items")
except Exception as e:
    print("⚠️ TMDB enricher not loaded:", e)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "CineMIS AI Backend is running 🚀"}

@app.get("/ping")
async def ping():
    return {"message": "pong"}

@app.get("/ffmpeg-check")
def ffmpeg_check():
    try:
        out = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if out.returncode == 0:
            line1 = out.stdout.splitlines()[0] if out.stdout else "ffmpeg present"
            return {"ok": True, "version": line1}
        return {"ok": False, "version": None}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ---- upload test ----
@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    return {"filename": file.filename, "content_type": file.content_type}

# ---- limits ----
MAX_VIDEO = 20 * 1024 * 1024  # 20MB
MAX_AUDIO = 5 * 1024 * 1024   # 5MB

# ---- Whisper helpers ----
from faster_whisper import WhisperModel
_ASR_MODELS = {}
def get_asr(size_name: str) -> WhisperModel:
    if size_name not in _ASR_MODELS:
        _ASR_MODELS[size_name] = WhisperModel(size_name, device="cpu", compute_type="int8")
    return _ASR_MODELS[size_name]

def choose_model_for_size(num_bytes: int) -> str:
    mb = num_bytes / (1024 * 1024)
    if mb <= 8:   return "small"
    if mb <= 14:  return "medium"
    return "large-v3"

def download_to_temp(url: str, max_bytes: int, suffix: str) -> Tuple[str, int]:
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=suffix)
    written = 0
    try:
        with os.fdopen(fd, "wb") as out:
            for chunk in r.iter_content(1024 * 1024):
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    try: os.remove(path)
                    except: pass
                    raise HTTPException(status_code=413, detail="File exceeds server limit")
                out.write(chunk)
        return path, written
    except:
        try: os.remove(path)
        except: pass
        raise

def to_wav_16k_mono(input_path: str) -> str:
    out_path = tempfile.mktemp(suffix=".wav")
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vn", "-ac", "1", "-ar", "16000", out_path]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"ffmpeg error converting audio")
    return out_path

def extract_audio_from_video(video_path: str) -> str:
    return to_wav_16k_mono(video_path)

# ---- TMDB overview semantic search (kept) ----
def search_semantic(text: str, top_k: int = 5) -> List[Dict[str, Any]]:
    emb = model.encode([text])[0].astype("float32").reshape(1, -1)
    distances, indices = index.search(emb, top_k)
    results = []
    for idx, dist in zip(indices[0], distances[0]):
        item = metadata[idx]
        results.append({
            "title": item.get("title"),
            "year": item.get("year"),
            "overview": item.get("overview"),
            "genre": item.get("genre"),
            "poster": item.get("poster"),
            "trailer": item.get("trailer"),
            "type": item.get("type"),
            "score": float(dist),
            "source": "tmdb-overview"
        })
    return results

def transcribe_wav(wav_path: str, model_size: str) -> str:
    asr = get_asr(model_size)
    segments, _ = asr.transcribe(wav_path, beam_size=1)
    return " ".join([s.text.strip() for s in segments if s.text.strip()])

# ---- NEW: subtitle-only matcher endpoint ----
class SubMatchPayload(BaseModel):
    transcript: str
    top_k_per_window: int = 5

@app.post("/match-subtitles")
def match_subtitles(payload: SubMatchPayload):
    if sub_matcher is None:
        raise HTTPException(status_code=503, detail="Subtitle index not ready")
    out = sub_matcher.search(payload.transcript, payload.top_k_per_window)
    # try enrich top 20 with TMDB posters/trailers
    enriched = []
    if tmdb_enricher:
        for c in out["candidates"][:20]:
            add = tmdb_enricher.enrich(c.get("title"), c.get("year"))
            if add:
                c = dict(c) | {
                    "poster": add.get("poster"),
                    "trailer": add.get("trailer"),
                    "type": add.get("type"),
                }
            enriched.append(c)
    else:
        enriched = out["candidates"][:20]
    return {"windows": out["windows"], "candidates": enriched}

# ---- NEW: late fusion of TMDB + subtitles ----
def reciprocal_rank_fusion(list_a: List[Dict[str, Any]],
                           list_b: List[Dict[str, Any]],
                           k: int = 60,
                           top_n: int = 10) -> List[Dict[str, Any]]:
    def make_key(x):
        return f"{(x.get('title') or '').strip().lower()}|{x.get('year')}"
    ranks_a = {make_key(r): i for i, r in enumerate(list_a)}
    ranks_b = {make_key(r): i for i, r in enumerate(list_b)}
    all_keys = set(ranks_a) | set(ranks_b)

    fused = []
    for kk in all_keys:
        ra = ranks_a.get(kk, 10**6)
        rb = ranks_b.get(kk, 10**6)
        score = 1.0 / (k + ra) + 1.0 / (k + rb)
        fused.append((kk, score))
    fused.sort(key=lambda t: t[1], reverse=True)

    index_b = {make_key(r): r for r in list_b}
    index_a = {make_key(r): r for r in list_a}

    merged = []
    for kk, s in fused[:top_n]:
        cand = index_b.get(kk) or index_a.get(kk)
        out = dict(cand)
        out["fused_score"] = s
        alt = index_a.get(kk) if cand is index_b.get(kk) else index_b.get(kk)
        if alt:
            for fld in ("poster", "trailer", "overview", "genre", "type"):
                if not out.get(fld) and alt.get(fld):
                    out[fld] = alt[fld]
        merged.append(out)
    return merged

# ---- existing plot search kept ----
class PlotQuery(BaseModel):
    query: str
    top_k: int = 5

@app.post("/search-plot")
async def search_plot(payload: PlotQuery):
    return {"results": search_semantic(payload.query, top_k=payload.top_k)}

# ---- identify from url: now runs BOTH matchers and fuses ----
class IdentifyPayload(BaseModel):
    url: str
    type: str  # "video" or "audio"
    top_k: int = 5

@app.post("/identify-from-url")
async def identify_from_url(payload: IdentifyPayload):
    if payload.type not in ("video", "audio"):
        raise HTTPException(status_code=400, detail="type must be 'video' or 'audio'")

    # 1) download
    if payload.type == "video":
        local_path, num_bytes = download_to_temp(payload.url, MAX_VIDEO, ".mp4")
    else:
        local_path, num_bytes = download_to_temp(payload.url, MAX_AUDIO, ".bin")

    model_size = choose_model_for_size(num_bytes)

    # 2) audio to wav
    if payload.type == "video":
        wav = extract_audio_from_video(local_path)
    else:
        wav = to_wav_16k_mono(local_path)

    # 3) transcribe
    transcript = transcribe_wav(wav, model_size)

    # 4a) TMDB overview semantic
    tmdb_results = search_semantic(transcript, top_k=max(10, payload.top_k))

    # 4b) Subtitle matching + enrich
    sub_candidates = []
    if sub_matcher is not None:
        sub_out = sub_matcher.search(transcript, k_per_win=5)
        raw_sub = sub_out.get("candidates", [])[:20]
        if tmdb_enricher:
            for c in raw_sub:
                add = tmdb_enricher.enrich(c.get("title"), c.get("year"))
                if add:
                    c = dict(c) | {
                        "poster": add.get("poster"),
                        "trailer": add.get("trailer"),
                        "type": add.get("type"),
                        "overview": add.get("overview"),
                        "genre": add.get("genre"),
                    }
                sub_candidates.append(c)
        else:
            sub_candidates = raw_sub

    # 5) Late fusion
    fused = reciprocal_rank_fusion(tmdb_results, sub_candidates, k=60, top_n=max(10, payload.top_k))

    # 6) cleanup
    try:
        os.remove(local_path); os.remove(wav)
    except Exception:
        pass

    return {
        "model_used": model_size,
        "transcript": transcript,
        "tmdb_overview_results": tmdb_results[:payload.top_k],
        "subtitle_candidates": sub_candidates[:payload.top_k],
        "fused_top": fused[:payload.top_k],
    }
