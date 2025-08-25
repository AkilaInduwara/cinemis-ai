import React, { useEffect, useState } from "react";


const BackendTest = () => {
  useEffect(() => {
    // Backend ping
    fetch("http://localhost:8000/ping")
      .then((res) => res.json())
      .then((data) => console.log("Backend Status:", "✅ Connected: " + data.message))
      .catch(() => console.log("Backend Status:", "❌ Failed to connect"));

    // FFmpeg check
    fetch("http://localhost:8000/ffmpeg-check")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          console.log("FFmpeg Status:", "✅ " + data.version);
        } else {
          console.log("FFmpeg Status:", "❌ " + (data.error || "FFmpeg not available"));
        }
      })
      .catch(() => console.log("FFmpeg Status:", "❌ Failed to check FFmpeg"));
  }, []);

  return null;
};

export default BackendTest;
