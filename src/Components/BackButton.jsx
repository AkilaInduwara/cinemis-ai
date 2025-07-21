import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/BackButton.css'; // Add the styles for the back button

const BackButton = ({ onBackConfirm }) => {
  const navigate = useNavigate();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  const handleBackClick = async () => {
    if (onBackConfirm) {
      const shouldGoBack = await onBackConfirm();
      if (!shouldGoBack) return;
    }

    if (canGoBack) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      className={`back-button ${!canGoBack ? 'disabled' : ''}`}
      onClick={handleBackClick}
      disabled={!canGoBack}
    >
      <span className="back-arrow"></span> Back
    </button>
  );
};

export default BackButton;