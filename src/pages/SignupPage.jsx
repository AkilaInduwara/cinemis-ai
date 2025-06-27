import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/SignupPage.css";
import BackButton from "../Components/BackButton";

const SignupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignupClick = () => {
    // Add signup logic here
    if (password === confirmPassword) {
      navigate("/home"); // Redirect to home page after signup
    } else {
      alert("Passwords do not match!");
    }
  };

  return (
    <div className="signuppage-hero-container">
      {/* Background Image */}
      <div className="signuppage-background-image"></div>
      <div className="signuppage-background-overlay"></div>

      <div className="signuppage-main-content">
        <BackButton />
        <h1 className="signuppage-logo">CineMIS AI</h1>
        <p className="signuppage-tagline">Find your Movie with us</p>

        <div className="signuppage-form-container">
          <input
            type="text"
            placeholder="Enter Name"
            className="signuppage-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Enter Email"
            className="signuppage-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Enter Password"
            className="signuppage-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="signuppage-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button className="signuppage-btn" onClick={handleSignupClick}>
            SIGN UP
          </button>

          <p className="signuppage-signin">
            Already Have an Account?{" "}
            <span onClick={() => navigate("/login")}>Log in</span>
          </p>

          <div className="signuppage-social-signin">
            <button className="signuppage-social-btn">
              Sign up with Google
            </button>
            <button className="signuppage-social-btn">
              Sign up with Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
