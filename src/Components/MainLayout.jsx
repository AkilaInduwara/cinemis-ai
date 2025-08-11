// src/Components/MainLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import "../css/MainLayout.css";

const ROTATE_MS = 6000; // change slide every 6s

// Vite will import all matching files as URLs at build time
const modules = import.meta.glob(
  "/src/Images/backgrounds/*.{jpg,jpeg,png,webp,avif}",
  { eager: true, import: "default", query: "?url" }
);

const backgroundUrls = Object.values(modules);

const preload = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

export default function MainLayout() {
  const [ready, setReady] = useState(false);
  const [showA, setShowA] = useState(true);
  const [urlA, setUrlA] = useState(null);
  const [urlB, setUrlB] = useState(null);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  // shuffle once so you don’t always start with the same image
  const urls = useMemo(() => {
    const arr = [...backgroundUrls];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // initial load of first two images
  useEffect(() => {
    let cancelled = false;
    if (urls.length === 0) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        await preload(urls[0]);
        if (cancelled) return;
        setUrlA(urls[0]);

        if (urls.length > 1) {
          await preload(urls[1]);
          if (cancelled) return;
          setUrlB(urls[1]);
        }

        setReady(true);
        indexRef.current = 1; // prepared 0 and 1
      } catch {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urls]);

  // rotate with crossfade
  useEffect(() => {
    if (!ready || urls.length < 2) return;

    clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      const nextIndex = (indexRef.current + 1) % urls.length;
      const nextUrl = urls[nextIndex];

      try { await preload(nextUrl); } catch {}

      if (showA) {
        setUrlB(nextUrl);
        setShowA(false);
      } else {
        setUrlA(nextUrl);
        setShowA(true);
      }
      indexRef.current = nextIndex;
    }, ROTATE_MS);

    return () => clearInterval(timerRef.current);
  }, [ready, urls, showA]);

  return (
    <div className="mainlayout-container">
      {!ready && <div className="loading-overlay">Loading...</div>}

      <div
        className={`bg-layer layer-a ${showA ? "visible" : ""}`}
        style={urlA ? { backgroundImage: `url(${urlA})` } : {}}
      />
      <div
        className={`bg-layer layer-b ${!showA ? "visible" : ""}`}
        style={urlB ? { backgroundImage: `url(${urlB})` } : {}}
      />

      <div className="mainlayout-background-overlay"></div>

      <div className="mainlayout-content">
        <Outlet />
      </div>
    </div>
  );
}
