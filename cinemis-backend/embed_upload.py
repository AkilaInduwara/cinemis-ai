import os
import json
import time
import requests
import tqdm
import pinecone
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

# Load environment variables
load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV") or "us-east-1-aws"
PINECONE_INDEX = os.getenv("PINECONE_INDEX") or "cine-index"
HUGGINGFACE_API_TOKEN = os.getenv("HF_API_KEY")

# Use this model
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
HEADERS = {"Authorization": f"Bearer {HUGGINGFACE_API_TOKEN}"}


def embed(text):
    """Generate embedding from Hugging Face."""
    response = requests.post(
        HUGGINGFACE_API_URL,
        headers=HEADERS,
        json={"inputs": text, "options": {"wait_for_model": True}}
    )

    if response.status_code == 429:
        print("⚠️ Rate limit hit. Waiting...")
        time.sleep(5)
        return embed(text)

    if not response.ok:
        raise Exception(f"HuggingFace API error: {response.status_code} - {response.text}")

    # Fix: HuggingFace returns {"embeddings": [...]}, but sometimes just a list
    result = response.json()
    if isinstance(result, dict) and "embeddings" in result:
        return result["embeddings"][0]
    elif isinstance(result, list):
        return result[0]
    else:
        raise Exception(f"Unexpected embedding response: {result}")


def load_data(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    # Load data
    data = load_data("combined_movie_tv_data.json")

    # Initialize Pinecone (new API)
    pc = Pinecone(api_key=PINECONE_API_KEY)
    # Create index if not exists
    if PINECONE_INDEX not in [idx.name for idx in pc.list_indexes()]:
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
    index = pc.Index(PINECONE_INDEX)

    for item in tqdm.tqdm(data):
        try:
            title = item.get("title", "")
            description = item.get("overview", "")
            year = item.get("year", "Unknown")

            combined_text = f"{title} ({year}): {description}"
            embedding = embed(combined_text)

            # Pinecone expects embedding as a list of floats
            index.upsert([(str(item["id"]), embedding, item)])

        except Exception as e:
            print(f"❌ Error embedding '{item.get('title', '')}': {e}")


if __name__ == "__main__":
    main()
