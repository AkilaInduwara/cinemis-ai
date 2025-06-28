// HomePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/HomePage.css";
import BackButton from "../Components/BackButton";  // Assuming you have BackButton component

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="homepage-hero-container">
      {/* Background Image */}
      <div className="homepage-background-image"></div>

      <div className="homepage-background-overlay"></div>

      <div className="homepage-main-content">
        <BackButton /> {/* Back button component */}

        <h1 className="homepage-logo">CineMIS AI</h1>
        <p className="homepage-tagline">Find your Movie with us</p>

        <div className="homepage-search-container">
          <input
            type="text"
            placeholder="Enter plot details, a dialogue or movie details"
            className="homepage-search-bar"
          />
          <button className="homepage-search-btn">Search</button>
        </div>

        <div className="homepage-upload-container">
          <button className="homepage-upload-btn">Upload VIDEO</button>
          <button className="homepage-upload-btn">Upload AUDIO</button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
