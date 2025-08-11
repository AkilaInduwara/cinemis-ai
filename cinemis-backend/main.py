# main.py

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss
import pickle
import numpy as np
import os, tempfile, subprocess, requests
from typing import Tuple
from faster_whisper import WhisperModel


# Load FAISS index and metadata
index = faiss.read_index("movie_index.faiss")
with open("metadata.pkl", "rb") as f:
    metadata = pickle.load(f)

# Load model
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

app = FastAPI()

# Allow requests from your frontend (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # change to ["http://localhost:5173"] for security
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

@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    return {
        "filename": file.filename,
        "content_type": file.content_type
    }

# ---- limits (match your frontend) ----
MAX_VIDEO = 20 * 1024 * 1024  # 20MB
MAX_AUDIO = 5 * 1024 * 1024   # 5MB

# ---- ASR cache + chooser (by uploaded size) ----
_ASR_MODELS = {}
def get_asr(size_name: str) -> WhisperModel:
    if size_name not in _ASR_MODELS:
        # CPU + int8 is free and light; if you have GPU, use device="cuda", compute_type="float16"
        _ASR_MODELS[size_name] = WhisperModel(size_name, device="cpu", compute_type="int8")
    return _ASR_MODELS[size_name]

def choose_model_for_size(num_bytes: int) -> str:
    mb = num_bytes / (1024 * 1024)
    if mb <= 8:   return "small"
    if mb <= 14:  return "medium"
    return "large-v3"

# ---- download to temp with size cap ----
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

# ---- ffmpeg helpers ----
def to_wav_16k_mono(input_path: str) -> str:
    out_path = tempfile.mktemp(suffix=".wav")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vn", "-ac", "1", "-ar", "16000", out_path
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"ffmpeg error converting audio")
    return out_path

def extract_audio_from_video(video_path: str) -> str:
    # same conversion; ffmpeg will ignore video and produce wav
    return to_wav_16k_mono(video_path)

# ---- shared FAISS search helper (uses your loaded `model`, `index`, `metadata`) ----
def search_semantic(text: str, top_k: int = 5):
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
            "score": float(dist)
        })
    return results

def transcribe_wav(wav_path: str, model_size: str) -> str:
    asr = get_asr(model_size)
    segments, _ = asr.transcribe(wav_path, beam_size=1)  # greedy = fastest
    return " ".join([s.text.strip() for s in segments if s.text.strip()])


class PlotQuery(BaseModel):
    query: str
    top_k: int = 5

@app.post("/search-plot")
async def search_plot(payload: PlotQuery):
    query = payload.query
    top_k = payload.top_k

    # Embed user query
    embedding = model.encode([query])[0].astype("float32").reshape(1, -1)

    # Search FAISS index
    distances, indices = index.search(embedding, top_k)

    results = []
    for idx, dist in zip(indices[0], distances[0]):
        item = metadata[idx]
        results.append({
            "title": item.get("title"),
            "year": item.get("year"),
            "overview": item.get("overview"),
            "genre": item.get("genre"),
            "poster": item.get("poster"),      # ✅ now included
            "trailer": item.get("trailer"),    # ✅ now included
            "score": float(dist)
        })

    return {"results": results}


class IdentifyPayload(BaseModel):
    url: str
    type: str  # "video" or "audio"
    top_k: int = 5

@app.post("/identify-from-url")
async def identify_from_url(payload: IdentifyPayload):
    if payload.type not in ("video", "audio"):
        raise HTTPException(status_code=400, detail="type must be 'video' or 'audio'")

    # 1) download (respect size caps)
    if payload.type == "video":
        local_path, num_bytes = download_to_temp(payload.url, MAX_VIDEO, ".mp4")
    else:
        local_path, num_bytes = download_to_temp(payload.url, MAX_AUDIO, ".bin")

    # 2) choose whisper size
    model_size = choose_model_for_size(num_bytes)

    # 3) ensure 16k mono WAV
    if payload.type == "video":
        wav = extract_audio_from_video(local_path)
    else:
        wav = to_wav_16k_mono(local_path)

    # 4) transcribe -> search FAISS
    transcript = transcribe_wav(wav, model_size)
    results = search_semantic(transcript, top_k=payload.top_k)

    # 5) cleanup
    try:
        os.remove(local_path)
        os.remove(wav)
    except:
        pass

    return {"model_used": model_size, "transcript": transcript, "results": results}

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
