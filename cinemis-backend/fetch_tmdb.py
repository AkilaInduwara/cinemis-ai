import tmdbsimple as tmdb
import pandas as pd
from time import sleep
import os
from dotenv import load_dotenv

load_dotenv()
tmdb.API_KEY = os.getenv("TMDB_API_KEY")

movies = []
for page in range(1, 1001):  # 1000 pages = ~20,000 movies
    try:
        response = tmdb.Discover().movie(page=page, sort_by="popularity.desc")
        for movie in response['results']:
            movies.append({
                "title": movie['title'],
                "overview": movie.get('overview', ''),
                "id": movie['id']
            })
        print(f"Fetched page {page}")
        sleep(0.25)  # To avoid hitting TMDb rate limit
    except Exception as e:
        print("Error:", e)

df = pd.DataFrame(movies).drop_duplicates()
df.to_csv("tmdb_movies_large.csv", index=False)
print(f"✅ Saved {len(df)} movies to tmdb_movies_large.csv")

