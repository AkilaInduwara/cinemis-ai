# sub_matcher.py
from pathlib import Path
import os, re, pickle, faiss
from typing import Dict, Any, List
from sentence_transformers import SentenceTransformer

BASE_DIR  = Path(__file__).resolve().parent
DATA_DIR  = Path(os.getenv("SUBS_INDEX_DIR", BASE_DIR / "data" / "subs_index")).resolve()
FAISS_PATH = DATA_DIR / "subs_index.faiss"
META_PATH  = DATA_DIR / "subs_index_meta.pkl"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_SENT_SPLIT = re.compile(r"(?<=[\.\!\?])\s+")

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

class SubtitleMatcher:
    def __init__(self):
        if not FAISS_PATH.exists():
            raise FileNotFoundError(f"Subtitle FAISS not found: {FAISS_PATH}")
        if not META_PATH.exists():
            raise FileNotFoundError(f"Subtitle metadata not found: {META_PATH}")

        self.index = faiss.read_index(str(FAISS_PATH))
        with open(META_PATH, "rb") as f:
            self.meta = pickle.load(f)

        self.model = SentenceTransformer(MODEL_NAME)

    def _windows(self, text: str, win_sents: int = 3, stride: int = 2) -> List[str]:
        sents = [_norm(s) for s in _SENT_SPLIT.split(text) if s.strip()]
        if not sents:
            t = _norm(text)
            return [t[:512]] if t else []
        out = []
        i = 0
        while i < len(sents):
            chunk = " ".join(sents[i:i + win_sents])
            if len(chunk) > 48:
                out.append(chunk[:512])
            i += stride
        return out or [text[:512]]

    def search(self, transcript: str, k_per_win: int = 5) -> Dict[str, Any]:
        wins = self._windows(transcript)
        if not wins:
            return {"windows": 0, "candidates": []}

        X = self.model.encode(
            wins,
            normalize_embeddings=True,
            convert_to_numpy=True
        ).astype("float32")

        D, I = self.index.search(X, k_per_win)

        tallies: Dict[str, Dict[str, Any]] = {}
        for w_idx, (ids, sims) in enumerate(zip(I, D)):
            for idx, sim in zip(ids, sims):
                if idx < 0:
                    continue
                m = self.meta[idx]
                key = f"{m.get('title_guess')}|{m.get('season')}|{m.get('episode')}|{m.get('year_guess')}"
                rec = tallies.setdefault(key, {
                    "title":  m.get("title_guess"),
                    "season": m.get("season"),
                    "episode":m.get("episode"),
                    "year":   m.get("year_guess"),
                    "score":  0.0,
                    "hits":   0,
                    "examples": []
                })
                rec["score"] += float(sim)
                rec["hits"]  += 1
                if len(rec["examples"]) < 3:
                    rec["examples"].append({
                        "window_idx": w_idx,
                        "sim": float(sim),
                        "file": m.get("inner_name"),
                        "source": m.get("source"),
                    })

        ranked = sorted(tallies.values(), key=lambda r: (r["score"], r["hits"]), reverse=True)
        return {"windows": len(wins), "candidates": ranked[:50]}
