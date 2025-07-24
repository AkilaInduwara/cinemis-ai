import os
import openai
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX", "cine-index")

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

# Create index if it doesn't exist
if pinecone_index_name not in pc.list_indexes().names():
    pc.create_index(
        name=pinecone_index_name,
        dimension=1536,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")  # Match your Pinecone env
    )

index = pc.Index(pinecone_index_name)

# Load movie data
df = pd.read_csv("tmdb_movies_large.csv").dropna(subset=["overview"])

# Upload embeddings
for _, row in tqdm(df.iterrows(), total=len(df)):
    try:
        overview = row["overview"]
        title = row["title"]

        embedding = openai.Embedding.create(
            input=overview,
            model="text-embedding-ada-002"
        )["data"][0]["embedding"]

        index.upsert([
            {
                "id": title,
                "values": embedding,
                "metadata": {"overview": overview}
            }
        ])
    except Exception as e:
        print(f"❌ Failed for '{title}': {e}")
