import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/BackButton.css'; // Add the styles for the back button

const BackButton = () => {
  const navigate = useNavigate();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      setCanGoBack(true);  // There is history to go back to
    } else {
      setCanGoBack(false);  // No history, so disable the button
    }
  }, []);

  const handleBackClick = () => {
    if (canGoBack) {
      navigate(-1); // Go back to the previous page
    } else {
      navigate('/'); // Redirect to the home page if no history
    }
  };

  return (
    <button
      className={`back-button ${!canGoBack ? 'disabled' : ''}`}
      onClick={handleBackClick}
      disabled={!canGoBack}  // Disable the button when no history to go back to
    >
      <span className="back-arrow"></span> Back
    </button>
  );
};

export default BackButton;