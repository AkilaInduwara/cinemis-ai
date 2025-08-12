import React, { useEffect, useState } from "react";

const BackendTest = () => {
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [ffmpegStatus, setFfmpegStatus] = useState("Checking...");

  useEffect(() => {
    // Backend ping
    fetch("http://localhost:8000/ping")
      .then((res) => res.json())
      .then((data) => setBackendStatus("✅ Connected: " + data.message))
      .catch(() => setBackendStatus("❌ Failed to connect"));

    // FFmpeg check
    fetch("http://localhost:8000/ffmpeg-check")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setFfmpegStatus("✅ " + data.version);
        } else {
          setFfmpegStatus("❌ " + (data.error || "FFmpeg not available"));
        }
      })
      .catch(() => setFfmpegStatus("❌ Failed to check FFmpeg"));
  }, []);

  return (
    <div style={{ marginTop: 20, color: "white", textAlign: "center" }}>
      <h3>Backend Status: {backendStatus}</h3>
      <h3>FFmpeg Status: {ffmpegStatus}</h3>
    </div>
  );
};

export default BackendTest;
