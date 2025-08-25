# test_sub_matcher.py
from sub_matcher import SubtitleMatcher

m = SubtitleMatcher()
print("index ntotal:", m.index.ntotal)

sample = """
No, I am your father. Search your feelings. You know it to be true.
Join me, and together we can rule the galaxy as father and son.
"""

res = m.search(sample, k_per_win=5)
print("windows:", res["windows"])
for i, c in enumerate(res["candidates"][:5], 1):
    print(f"{i}. {c['title']} (S{c['season']}E{c['episode']}, {c['year']}) "
          f"score={c['score']:.3f} hits={c['hits']}")
