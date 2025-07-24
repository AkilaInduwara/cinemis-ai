import tmdbsimple as tmdb
import pandas as pd
from time import sleep
import os
from dotenv import load_dotenv

load_dotenv()
tmdb.API_KEY = os.getenv("TMDB_API_KEY")

# Genre mappings (shared with TV/movie)
genres = {
    28: "Action",
    35: "Comedy",
    18: "Drama",
    10765: "Sci-Fi & Fantasy",
    10759: "Action & Adventure",
    80: "Crime",
    9648: "Mystery",
    10749: "Romance",
    99: "Documentary"
}

years = list(range(1990, 2026))  # From 1990 to 2025
max_pages_per_combo = 5  # Tune this to increase total results

results = []

# ---- Fetch MOVIES ----
for genre_id, genre_name in genres.items():
    for year in years:
        for page in range(1, max_pages_per_combo + 1):
            try:
                response = tmdb.Discover().movie(
                    page=page,
                    sort_by="popularity.desc",
                    with_genres=genre_id,
                    primary_release_year=year
                )
                for movie in response['results']:
                    results.append({
                        "type": "movie",
                        "title": movie['title'],
                        "overview": movie.get('overview', ''),
                        "id": movie['id'],
                        "genre": genre_name,
                        "year": year
                    })
                print(f"🎬 Movie | {genre_name} | {year} | Page {page}")
                sleep(0.25)
            except Exception as e:
                print(f"❌ Movie Error: {e} | {genre_name} | {year} | Page {page}")
                sleep(1)

# ---- Fetch TV SHOWS ----
for genre_id, genre_name in genres.items():
    for year in years:
        for page in range(1, max_pages_per_combo + 1):
            try:
                response = tmdb.Discover().tv(
                    page=page,
                    sort_by="popularity.desc",
                    with_genres=genre_id,
                    first_air_date_year=year
                )
                for tv in response['results']:
                    results.append({
                        "type": "tv",
                        "title": tv['name'],
                        "overview": tv.get('overview', ''),
                        "id": tv['id'],
                        "genre": genre_name,
                        "year": year
                    })
                print(f"📺 TV | {genre_name} | {year} | Page {page}")
                sleep(0.25)
            except Exception as e:
                print(f"❌ TV Error: {e} | {genre_name} | {year} | Page {page}")
                sleep(1)

# ---- Save Combined Results ----
df = pd.DataFrame(results).drop_duplicates(subset=["type", "id"])
df = df[df["overview"].str.strip().astype(bool)]  # Remove empty overviews
df.to_csv("tmdb_movies_tv_large.csv", index=False)
print(f"\n✅ Saved {len(df)} total movies and TV shows to tmdb_movies_tv_large.csv")
