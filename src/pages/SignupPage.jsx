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
  const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const handleSignupClick = async () => {
  if (!isValidEmail(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("Signup failed:", signUpError.message);
    alert("Signup failed: " + signUpError.message);
    return;
  }

  const user = signUpData?.user;
  if (user) {
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!existingUser) {
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: user.id,
          name: name,
          email: user.email,
          created_at: new Date(),
        },
      ]);

      if (insertError) {
        console.error("Insert failed:", insertError.message);
      }
    } else {
      console.log("User already exists.");
    }
  }

  alert("Signup successful!");
  navigate("/login");
};

const handleSocialSignup = async (provider) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'http://localhost:5173/home',
    },
  });
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
