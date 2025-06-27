import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import '../css/StartPage.css'

const StartPage = () => {
   
  // Initialize the navigate function from react-router-dom
  const navigate = useNavigate();

  // Function to handle login button click
  const handleLoginClick = () => {
    navigate('/login'); // Navigate to the LoginPage

  }

  const handleSignUpClick = () => {
    navigate('/signup'); // Navigate to the SignupPage
  }
  return (
     <div className="startpage-main-content">
      <h1 className="startpage-logo">CineMIS AI</h1>
      <p className="startpage-tagline">Find your Movie with us</p>
      <div className="startpage-button-container">
        <button 
          className="startpage-btn startpage-btn-login"
          onClick={handleLoginClick}
        >
          Log In
        </button>
        <button 
        className="startpage-btn startpage-btn-signin"
        onClick={handleSignUpClick}
        >Sign Up</button>
      </div>
    </div>
  )
}

export default StartPage
