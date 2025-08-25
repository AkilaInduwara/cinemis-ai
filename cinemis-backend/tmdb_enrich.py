# tmdb_enrich.py
from pathlib import Path
import pickle
from typing import Dict, Any, List, Optional
from rapidfuzz import process, fuzz

META_FILE = Path("metadata.pkl")

class TMDBEnricher:
    def __init__(self, score_cutoff: int = 85):
        self.score_cutoff = score_cutoff

        if META_FILE.exists():
            with META_FILE.open("rb") as f:
                self.items: List[Dict[str, Any]] = pickle.load(f)
        else:
            self.items = []

        self.title_to_items: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
            t = (it.get("title") or "").strip().lower()
            if not t:
                continue
            self.title_to_items.setdefault(t, []).append(it)
        self.known_titles = list(self.title_to_items.keys())

    def _pick_best_year(self, items: List[Dict[str, Any]], year: Optional[str]):
        if not items:
            return None
        if year:
            exact = [it for it in items if str(it.get("year")) == str(year)]
            if exact:
                return exact[0]
        items = sorted(
            items,
            key=lambda it: (bool(it.get("poster")), bool(it.get("overview"))),
            reverse=True,
        )
        return items[0]

    def enrich(self, title_guess: Optional[str], year_guess: Optional[str]) -> Optional[Dict[str, Any]]:
        if not title_guess:
            return None
        q = title_guess.strip().lower()
        if not q:
            return None

        if q in self.title_to_items:
            return self._pick_best_year(self.title_to_items[q], year_guess)

        match = process.extractOne(q, self.known_titles, scorer=fuzz.WRatio, score_cutoff=self.score_cutoff)
        if not match:
            return None

        best_title = match[0]
        return self._pick_best_year(self.title_to_items.get(best_title, []), year_guess)
