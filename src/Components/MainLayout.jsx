import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom'; // This will render child pages
import '../css/MainLayout.css';

const MainLayout = () => {
  // Array of background images for the slideshow
  const backgroundImages = [
    'url(src/Images/spider01.jpg)', 
    'url(src/Images/starwars.jpg)', 
    'url(src/Images/termi01.jpg)',
    'url(src/Images/thor01.jpg)',
    'url(src/Images/movie01.jpg)',
    'url(src/Images/bat01.jpg)',
    'url(src/Images/hobbit01.jpg)',
    'url(src/Images/top01.jpg)',
    'url(src/Images/still01.jpg)',
    'url(src/Images/avatar01.jpg)',
    'url(src/Images/avenger01.jpg)',
    'url(src/Images/open01.jpg)',
    'url(src/Images/1917.jpg)'
  ];

  // State to track the current background image index
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(intervalId); // Clean up the interval on unmount
  }, [backgroundImages.length]);

  return (
    <div className="mainlayout-container">
      {/* Background Image */}
      <div 
        className="mainlayout-background-image"
        style={{ backgroundImage: backgroundImages[currentIndex] }}
      ></div>

      <div className="mainlayout-background-overlay"></div>

      <div className="mainlayout-content">
        <Outlet /> {/* This will render the current page's component */}
      </div>
    </div>
  );
};

export default MainLayout;
