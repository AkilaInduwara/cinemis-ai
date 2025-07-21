import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom"; // This will render child pages
import "../css/MainLayout.css";
import { supabase } from "../supabaseClient";

const MainLayout = () => {
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchImageUrls = async () => {
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
          console.log("Resolved Public URL:", data?.publicUrl);
          return data?.publicUrl ? `url(${data.publicUrl})` : null;
        })
        .filter((url) => url !== null);

      setBackgroundImages(urls);
    };

    fetchImageUrls();
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
