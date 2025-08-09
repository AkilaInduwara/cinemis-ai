import pickle

# Load the metadata file
with open("metadata.pkl", "rb") as f:
    metadata = pickle.load(f)

# Check how many items are stored
print(f"Total items in metadata: {len(metadata)}\n")

# Print the first 5 entries
for i, item in enumerate(metadata[:5]):
    print(f"{i+1}. Title: {item.get('title')}")
    print(f"   Year: {item.get('year')}")
    print(f"   Genre: {item.get('genre')}")
    print(f"   Poster: {item.get('poster')}")
    print(f"   Trailer: {item.get('trailer')}")
    print()
