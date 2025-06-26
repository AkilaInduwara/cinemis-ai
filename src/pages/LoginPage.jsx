import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import '../css/LoginPage.css';

const LoginPage = () => {
 const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginClick = () => {
    // Add login logic here
    navigate('/home'); // Redirect to home page after login
  };

  return (
    <div className="loginpage-hero-container">
      {/* Background Image */}
      <div className="loginpage-background-image"></div>

      <div className="loginpage-background-overlay"></div>

      <div className="loginpage-main-content">
        <h1 className="loginpage-logo">CineMIS AI</h1>
        <p className="loginpage-tagline">Find your Movie with us</p>

        <div className="loginpage-form-container">
          <input
            type="email"
            placeholder="Enter Email"
            className="loginpage-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Enter Password"
            className="loginpage-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="loginpage-btn" onClick={handleLoginClick}>
            LOGIN
          </button>

          <p className="loginpage-signup">
            Don’t Have an Account? <span onClick={() => navigate('/signup')}>Sign up</span>
          </p>

          <div className="loginpage-social-signin">
            <button className="loginpage-social-btn">Sign in with Google</button>
            <button className="loginpage-social-btn">Sign in with Facebook</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
