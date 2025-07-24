import os
import openai
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX", "cine-index")

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)
index = pc.Index(pinecone_index_name)

def search_plot(user_input):
    embedding = openai.Embedding.create(
        input=user_input,
        model="text-embedding-ada-002"
    )["data"][0]["embedding"]

    result = index.query(vector=embedding, top_k=3, include_metadata=True)

    print("\n🔍 Best Matches:")
    for match in result["matches"]:
        print(f"\n🎬 Title: {match['id']} (Score: {match['score']:.2f})")
        print(f"📖 Overview: {match['metadata']['overview']}")

if __name__ == "__main__":
    user_input = input("📝 Describe the movie or show plot: ")
    search_plot(user_input)
