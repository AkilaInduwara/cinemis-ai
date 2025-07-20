import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/SignupPage.css";
import BackButton from "../Components/BackButton";
import { supabase } from "../supabaseClient";

const SignupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignupClick = async () => {
    if (!name || !email || !password || !confirmPassword) {
      alert("All fields are required!");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      console.error(error);
      alert("Signup failed!");
      return;
    }

    if (data.user) {
      alert("Signup successful!");
      navigate("/home");
    }
  };

  const handleSocialSignup = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) alert(`${provider} sign-in failed!`);
  };

  return (
    <div className="signuppage-hero-container">
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
            <button
              className="signuppage-social-btn"
              onClick={() => handleSocialSignup("google")}
            >
              Sign up with Google
            </button>
            <button
              className="signuppage-social-btn"
              onClick={() => handleSocialSignup("facebook")}
            >
              Sign up with Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
