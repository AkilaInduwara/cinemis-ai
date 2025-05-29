import React, {useEffect} from 'react'
import "../css/HomePage.css"
import { useNavigate, useLocation } from "react-router-dom";

const HomePage = () => {
    const navigate = useNavigate();
  useEffect(() => {
    const container = document.querySelector('.home-container');
    
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      container.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      container.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleLogin = () => {
    console.log('Login clicked');   
    navigate('/login');
  };

  const handleSignIn = () => {
    console.log('Sign Up clicked');  
    navigate('/signup');
    // Example: navigate('/register')
  };

  return (
    <div className="home-container">
      <h1 className="home-title">CineMIS AI</h1>
      <p className="home-subtitle">Find your Movie with us</p>
      <div className="home-button-container">
        <button className="home-btn home-btn-login" onClick={handleLogin}>Log In</button>
        <button className="home-btn home-btn-signin" onClick={handleSignIn}>Sign Up</button>
      </div>
    </div>
  );
}

export default HomePage
