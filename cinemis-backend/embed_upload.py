import os
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv

from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer

# Load environment variables
load_dotenv()

# Load embedding model (no API needed)
model = SentenceTransformer("all-MiniLM-L6-v2")

# Init Pinecone
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX", "cine-index")
pinecone_env = os.getenv("PINECONE_ENV", "us-east-1")

pc = Pinecone(api_key=pinecone_api_key)

# Create index if not exists
if pinecone_index_name not in pc.list_indexes().names():
    pc.create_index(
        name=pinecone_index_name,
        dimension=384,  # all-MiniLM-L6-v2 has 384 dimensions
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region=pinecone_env)
    )

index = pc.Index(pinecone_index_name)

# Load dataset
df = pd.read_csv("tmdb_movies_tv_large.csv")
df = df.dropna(subset=["overview"])
df = df[df["overview"].str.strip().astype(bool)]

# Get existing vector IDs (optional)
print("🔍 Fetching existing vector IDs from Pinecone...")
existing_ids = set()

try:
    stats = index.describe_index_stats()
    total_vectors = stats.total_vector_count
    print(f"📦 Pinecone index currently has {total_vectors} vectors.")
except Exception as e:
    print(f"⚠️ Could not fetch Pinecone stats: {e}")

# Embed and upload
failed = []

print(f"📄 Starting embedding for {len(df)} items...")

for _, row in tqdm(df.iterrows(), total=len(df)):
    vector_id = f"{row['type']}_{row['id']}"

    if vector_id in existing_ids:
        continue  # Skip already uploaded

    try:
        text = row["overview"]
        embedding = model.encode(text).tolist()

        metadata = {
            "title": row["title"],
            "type": row["type"],
            "genre": row["genre"],
            "year": int(row["year"]),
            "overview": text
        }

        index.upsert([
            {
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            }
        ])

    except Exception as e:
        print(f"❌ Error embedding '{row.get('title', 'Unknown')}': {e}")
        failed.append(row.get("title", "Unknown"))

# Save failed ones
if failed:
    with open("failed_embeddings.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(failed))
    print(f"⚠️ {len(failed)} items failed. See 'failed_embeddings.txt'")
else:
    print("✅ All embeddings uploaded successfully.")
