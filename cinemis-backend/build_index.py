# build_index.py

import json
import faiss
import pickle
from sentence_transformers import SentenceTransformer
import numpy as np

# Load your data
with open("combined_movie_tv_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Init model
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

texts = []
metadata = []

for item in data:
    title = item.get("title", "")
    year = item.get("year", "Unknown")
    overview = item.get("overview", "").strip()

    if not overview:
        continue

    full_text = f"{title} ({year}): {overview}"
    texts.append(full_text)
    metadata.append(item)

# Generate embeddings
print("📡 Generating embeddings...")
embeddings = model.encode(texts, show_progress_bar=True)
embeddings = np.array(embeddings).astype("float32")

# Build FAISS index
index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)

# Save the index
faiss.write_index(index, "movie_index.faiss")

# Save metadata
with open("metadata.pkl", "wb") as f:
    pickle.dump(metadata, f)

print("✅ Saved FAISS index and metadata.")
