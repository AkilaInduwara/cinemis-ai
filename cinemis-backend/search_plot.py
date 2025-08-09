import os
import openai
from dotenv import load_dotenv

# 🔧 New Pinecone import
from pinecone import Pinecone

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX", "cine-index")

# 🔧 Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)
index = pc.Index(pinecone_index_name)

def search_plot(user_input, top_k=5):
    embedding = openai.Embedding.create(
        input=user_input,
        model="text-embedding-ada-002"
    )["data"][0]["embedding"]

    results = index.query(
        vector=embedding,
        top_k=top_k,
        include_metadata=True
    )

    print(f"\n🔍 Top {top_k} Matches:\n")
    for match in results["matches"]:
        meta = match["metadata"]
        print(f"🎬 {meta['type'].upper()}: {meta['title']} ({meta['year']})")
        print(f"📁 Genre: {meta['genre']} | 🔢 Score: {match['score']:.2f}")
        print(f"📝 {meta['overview']}\n")

if __name__ == "__main__":
    user_input = input("🧠 Describe the movie or TV plot: ")
    search_plot(user_input)
