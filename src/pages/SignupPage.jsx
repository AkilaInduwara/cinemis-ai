import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/SignupPage.css";
import BackButton from "../Components/BackButton";
import { db } from "../firebase-config";  // Import Firebase config
import { collection, addDoc } from "firebase/firestore";  // Firestore functions
import bcrypt from "bcryptjs";
import { auth } from "../firebase-config";
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from "firebase/auth";

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

const SignupPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignupClick = async () => {
    // Check if any field is empty
    if (!name || !email || !password || !confirmPassword) {
      alert("All fields are required!");
      return;  // Stop the function if any field is empty
    }
    // Validate password
    if (password === confirmPassword) {
      try {
        // Hash the password using bcryptjs
        const hashedPassword = await bcrypt.hash(password, 10);

        // Add user data to Firestore (with hashed password)
        await addDoc(collection(db, "users"), {
          name: name,
          email: email,
          password: hashedPassword, // Store the hashed password
        });
        alert("Signup successful!");

        // Redirect to home page after signup
        navigate("/home");
      } catch (error) {
        console.error("Error adding document: ", error);
        alert("Error signing up!");
      }
    } else {
      alert("Passwords do not match!");
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);  // Trigger Google login
      const user = result.user;

      // Save Google user info to Firestore (without password)
      await addDoc(collection(db, "users"), {
        name: user.displayName,
        email: user.email,
        password: null, // No password for Google sign-in
      });

      navigate("/home");
    } catch (error) {
      console.error("Error with Google Sign-in: ", error);
      alert("Google Sign-in failed!");
    }
  };

  const handleFacebookSignup = async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);  // Trigger Facebook login
      const user = result.user;

      // Save Facebook user info to Firestore (without password)
      await addDoc(collection(db, "users"), {
        name: user.displayName,
        email: user.email,
        password: null, // No password for Facebook sign-in
      });

      navigate("/home");
    } catch (error) {
      console.error("Error with Facebook Sign-in: ", error);
      alert("Facebook Sign-in failed!");
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
            <button className="signuppage-social-btn" onClick={handleGoogleSignup}>
              Sign up with Google
            </button>
            <button className="signuppage-social-btn" onClick={handleFacebookSignup}>
              Sign up with Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
