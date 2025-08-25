# quick_dep_check.py
from importlib.metadata import version, PackageNotFoundError

def v(pkg):
    try:
        return version(pkg)
    except PackageNotFoundError:
        return "not installed"

# Light imports (won't download models)
import rapidfuzz
from sentence_transformers import SentenceTransformer
import faiss
import srt  # no __version__ attribute on this package

print("✅ srt installed:", srt is not None, "| version:", v("srt"))
print("✅ rapidfuzz:", v("rapidfuzz"))
print("✅ sentence-transformers:", v("sentence-transformers"))
print("✅ faiss-cpu:", v("faiss-cpu"))

# Sanity: FAISS basic capability
ok_faiss = hasattr(faiss, "IndexFlatL2")
print("🔎 FAISS IndexFlatL2 available:", ok_faiss)

# Tiny FAISS round-trip test (doesn't need GPU)
if ok_faiss:
    import numpy as np
    d = 8
    xb = np.random.rand(50, d).astype("float32")
    xq = np.random.rand(2, d).astype("float32")
    index = faiss.IndexFlatL2(d)
    index.add(xb)
    D, I = index.search(xq, 3)
    print("🧪 FAISS search ok? distances shape:", D.shape, "indices shape:", I.shape)

# Sanity: class exists (don’t download a model here)
print("🧠 SentenceTransformer class present:", SentenceTransformer is not None)
