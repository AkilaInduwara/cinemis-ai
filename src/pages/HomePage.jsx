import React, {useEffect} from 'react'
import "../css/HomePage.css"

const HomePage = () => {
  useEffect(() => {
    const container = document.querySelector('.login-container');
    
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
    // Example: navigate('/login')
  };

  const handleSignIn = () => {
    console.log('Sign Up clicked');
    // Example: navigate('/register')
  };

  return (
    <div className="login-container">
      <h1 className="login-title">CineMIS AI</h1>
      <p className="login-subtitle">Find your Movie with us</p>
      <div className="login-button-container">
        <button className="login-btn login-btn-login" onClick={handleLogin}>Log In</button>
        <button className="login-btn login-btn-signin" onClick={handleSignIn}>Sign Up</button>
      </div>
    </div>
  );
}

export default HomePage
