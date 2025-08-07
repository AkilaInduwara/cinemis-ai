# main.py

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss
import pickle
import numpy as np


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
            "score": float(dist)
        })

    return {"results": results}


