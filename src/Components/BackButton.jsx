import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/BackButton.css'; // Add the styles for the back button

const BackButton = () => {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <button className="back-button" onClick={handleBackClick}>
      <span className="back-arrow">←</span> Back
    </button>
  );
};

export default BackButton;

