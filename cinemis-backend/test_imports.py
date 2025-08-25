# test_imports.py

import openai
import pinecone
import pandas as pd
import tmdbsimple as tmdb
from tqdm import tqdm

print("✅ All required packages are installed and working!")

# Kaggle API test (Python code only, not shell)
try:
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    print("✅ Kaggle auth OK")
except Exception as e:
    print(f"❌ Kaggle auth failed: {e}")