import json
import faiss
import pickle
import requests
from sentence_transformers import SentenceTransformer
import numpy as np
import os
from dotenv import load_dotenv
from tqdm import tqdm

# Load TMDB key
load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# Fetch posters and trailers
def fetch_tmdb_details(content_type, tmdb_id):
    base_url = f"https://api.themoviedb.org/3/{content_type}/{tmdb_id}"
    params = {
        "api_key": TMDB_API_KEY,
        "append_to_response": "videos"
    }

    try:
        res = requests.get(base_url, params=params)
        res.raise_for_status()
        data = res.json()

        poster_path = data.get("poster_path")
        poster = f"https://image.tmdb.org/t/p/w300{poster_path}" if poster_path else None

        trailer = None
        for video in data.get("videos", {}).get("results", []):
            if video.get("type") == "Trailer" and video.get("site") == "YouTube":
                trailer = f"https://youtube.com/watch?v={video['key']}"
                break

        return poster, trailer
    except Exception as e:
        print(f"⚠️ TMDB fetch failed for {content_type} {tmdb_id}: {e}")
        return None, None

# Load and de-duplicate data
with open("combined_movie_tv_data.json", "r", encoding="utf-8") as f:
    raw_data = json.load(f)

seen_ids = set()
data = []
for item in raw_data:
    key = (item.get("type"), item.get("id"))
    if key not in seen_ids:
        data.append(item)
        seen_ids.add(key)

print(f"🔄 Building dataset with posters and trailers for {len(data)} unique items...")

# Init model
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
texts = []
metadata = []

# Enrich and embed
for item in tqdm(data, desc="🔍 Fetching & Embedding"):
    title = item.get("title", "")
    overview = item.get("overview", "").strip()
    year = item.get("year", "Unknown")
    genre = item.get("genre")
    content_type = item.get("type", "movie")
    tmdb_id = item.get("id")

    if not title or not overview:
        continue

    poster, trailer = fetch_tmdb_details(content_type, tmdb_id)
    full_text = f"{title} ({year}): {overview}"

    texts.append(full_text)
    metadata.append({
        "title": title,
        "year": year,
        "overview": overview,
        "genre": genre,
        "poster": poster,
        "trailer": trailer,
        "type": content_type
    })

# Embed
print("📡 Generating embeddings...")
embeddings = model.encode(texts, show_progress_bar=True)
embeddings = np.array(embeddings).astype("float32")

# Build FAISS index
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)

# Save index and metadata
faiss.write_index(index, "movie_index.faiss")
with open("metadata.pkl", "wb") as f:
    pickle.dump(metadata, f)

print("✅ Done! Saved FAISS index and metadata with posters + trailers.")
