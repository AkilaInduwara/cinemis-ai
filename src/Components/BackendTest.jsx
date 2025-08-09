// src/Components/BackendTest.jsx
import React, { useEffect, useState } from "react";

const BackendTest = () => {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    fetch("http://localhost:8000/ping")
      .then((res) => res.json())
      .then((data) => {
        console.log("Backend Response:", data);
        setStatus("✅ Connected: " + data.message);
      })
      .catch((err) => {
        console.error("Backend connection failed", err);
        setStatus("❌ Failed to connect");
      });
  }, []);

  return (
    <div style={{ marginTop: "20px", color: "white", textAlign: "center" }}>
      <h3>Backend Status: {status}</h3>
    </div>
  );
};

export default BackendTest;
