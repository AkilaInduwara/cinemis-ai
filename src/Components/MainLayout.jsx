import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom"; // This will render child pages
import "../css/MainLayout.css";
import { supabase } from "../supabaseClient";

// Preload a single image
const preloadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve();
  });

const MainLayout = () => {
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImagesFromCache = () => {
      const cached = localStorage.getItem("backgroundImages");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBackgroundImages(parsed);
            setLoading(false);
            return true;
          }
        } catch (err) {
          console.warn("Error parsing cached backgroundImages:", err);
        }
      }
      return false;
    };

    const fetchAndPreloadImages = async () => {
      const { data: files, error } = await supabase.storage
        .from("backgrounds")
        .list("", { limit: 100 });

      if (error) {
        console.error("Failed to fetch background images:", error.message);
        return;
      }

      const urls = files
        .map((file) => {
          const { data } = supabase.storage
            .from("backgrounds")
            .getPublicUrl(file.name);
          return data?.publicUrl || null;
        })
        .filter(Boolean);

      await Promise.all(urls.map(preloadImage));

      const styledUrls = urls.map((url) => `url(${url})`);
      setBackgroundImages(styledUrls);
      localStorage.setItem("backgroundImages", JSON.stringify(styledUrls));
      setLoading(false);
    };

    // Try to load from cache first
    const cacheHit = loadImagesFromCache();
    if (!cacheHit) {
      fetchAndPreloadImages();
    }
  }, []);

  useEffect(() => {
    if (backgroundImages.length === 0) return;

    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [backgroundImages]);

  return (
    <div className="mainlayout-container">
      {loading && <div className="loading-overlay">Loading...</div>}

      <div
        className="mainlayout-background-image"
        style={{ backgroundImage: backgroundImages[currentIndex] }}
      ></div>

      <div className="mainlayout-background-overlay"></div>

      <div className="mainlayout-content">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
