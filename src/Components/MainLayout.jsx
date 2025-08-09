import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import "../css/MainLayout.css";
import { supabase } from "../supabaseClient";

// Preload one image and resolve if it loads, reject if it fails
const preloadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(url);
    // Adding a cache-busting query helps avoid stale CDN versions
    img.src = `${url}?v=${Date.now()}`;
  });

// HEAD-check a URL so we can detect 404s quickly without downloading image bytes
const headCheck = async (url) => {
  try {
    const res = await fetch(`${url}?v=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
};

const CACHE_KEY = "backgroundImages_v2"; // bump key to avoid old cache
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const MainLayout = () => {
  const [backgroundImages, setBackgroundImages] = useState([]); // raw URLs
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load from cache if fresh
  const loadImagesFromCache = () => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached); // { ts, urls, names }
      if (
        parsed &&
        Array.isArray(parsed.urls) &&
        parsed.urls.length > 0 &&
        typeof parsed.ts === "number" &&
        Date.now() - parsed.ts < CACHE_TTL_MS
      ) {
        return parsed;
      }
    } catch {}
    return null;
  };

  const fetchFromSupabase = async () => {
    const { data: files, error } = await supabase.storage
      .from("backgrounds")
      .list("", { limit: 100 });
    if (error) {
      console.error("Failed to fetch background images:", error.message);
      return { urls: [], names: [] };
    }

    const items = files || [];
    const names = items.map((f) => f.name);
    const urls = items
      .map((file) => {
        const { data } = supabase.storage.from("backgrounds").getPublicUrl(file.name);
        return data?.publicUrl || null;
      })
      .filter(Boolean);

    return { urls, names };
  };

  // Reconcile cached list with bucket list (remove URLs for deleted files)
  const reconcileCache = (cached, namesFromBucket) => {
    if (!cached || !Array.isArray(cached.urls)) return cached;
    // If cached had names list, use it to filter; otherwise keep all (best-effort)
    if (Array.isArray(cached.names) && cached.names.length) {
      const allowedSet = new Set(namesFromBucket);
      const filteredUrls = cached.urls.filter((url) => {
        // try to get file name from the end of url path
        try {
          const u = new URL(url);
          const name = decodeURIComponent(u.pathname.split("/").pop() || "");
          return allowedSet.has(name);
        } catch {
          return true;
        }
      });
      return { ...cached, urls: filteredUrls };
    }
    return cached;
  };

  // Validate URLs by HEAD + preload (filters out stale CDN / deleted assets)
  const validateUrls = async (urls) => {
    const checked = await Promise.all(
      urls.map(async (u) => (await headCheck(u)) ? u : null)
    );
    const existing = checked.filter(Boolean);

    // Preload images (optional but nice to avoid flicker)
    const results = await Promise.allSettled(existing.map((u) => preloadImage(u)));
    const ok = results
      .map((r, i) => (r.status === "fulfilled" ? existing[i] : null))
      .filter(Boolean);

    return ok;
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);

      // 1) try cache
      let cached = loadImagesFromCache();

      // 2) always fetch latest file list to reconcile (so deleted files drop out)
      const { urls: freshUrls, names: freshNames } = await fetchFromSupabase();

      if (cached) {
        cached = reconcileCache(cached, freshNames);
        // combine: prefer freshUrls order; keep only those present
        const freshSet = new Set(freshUrls);
        const merged = cached.urls.filter((u) => freshSet.has(u));
        // plus any new ones not in cache yet
        const newOnes = freshUrls.filter((u) => !merged.includes(u));
        const candidate = [...merged, ...newOnes];

        const valid = await validateUrls(candidate);
        if (!cancelled) {
          setBackgroundImages(valid);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), urls: valid, names: freshNames })
          );
        }
      } else {
        // no cache: use fresh list
        const valid = await validateUrls(freshUrls);
        if (!cancelled) {
          setBackgroundImages(valid);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), urls: valid, names: freshNames })
          );
        }
      }

      if (!cancelled) setLoading(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rotate
  useEffect(() => {
    if (backgroundImages.length === 0) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 5000);
    return () => clearInterval(id);
  }, [backgroundImages]);

  const currentBg =
    backgroundImages.length > 0
      ? `url(${backgroundImages[currentIndex]}?v=${Date.now()})`
      : "none";

  return (
    <div className="mainlayout-container">
      {loading && <div className="loading-overlay">Loading...</div>}
      <div className="mainlayout-background-image" style={{ backgroundImage: currentBg }} />
      <div className="mainlayout-background-overlay"></div>
      <div className="mainlayout-content">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
