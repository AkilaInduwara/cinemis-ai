import React, { useState, useEffect } from 'react'
import '../css/StartPage.css'

const StartPage = () => {
    // Array of background images
  const backgroundImages = [
    'url(src/Images/spider01.jpg)', // Replace with actual background image URLs
    'url(src/Images/starwars.jpg)', // Add more images here
    'url(src/Images/termi01.jpg)',
    'url(src/Images/thor01.jpg)',
    'url(src/Images/movie01.jpg)',
    'url(src/Images/bat01.jpg)',
    'url(src/Images/brave01.jpg)',
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
    // Set an interval to change the background image every 5 seconds (5000ms)
    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000);

    // Cleanup the interval on component unmount
    return () => clearInterval(intervalId);
  }, [backgroundImages.length]);


  return (
     <div className="startpage-hero-container">
      {/* Background image section */}
      <div className="startpage-background-image"
      style={{ backgroundImage: backgroundImages[currentIndex] }}
      ></div>

      <div className="startpage-background-overlay"></div>
      <div className="startpage-main-content">
        <h1 className="startpage-logo">CineMIS AI</h1>
        <p className="startpage-tagline">Find your Movie with us</p>
        <div className="startpage-button-container">
          <button className="startpage-btn startpage-btn-login">Log In</button>
          <button className="startpage-btn startpage-btn-signin">Sign In</button>
        </div>
      </div>
    </div>
  )
}

export default StartPage
