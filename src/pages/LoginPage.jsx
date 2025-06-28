import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/LoginPage.css";
import BackButton from "../Components/BackButton";
import { db } from "../firebase-config";  // Import Firebase config
import { collection, query, where, getDocs } from "firebase/firestore";  // Firestore functions
import bcrypt from "bcryptjs";  // For password comparison
import { auth } from "../firebase-config";
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from "firebase/auth";

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLoginClick = async () => {

    // Check if both fields are filled
    if (!email || !password) {
      alert("Both fields are required!");
      return;  // Stop the function if any field is empty
    }

    try {
      // Create a query to find the user by email in the "users" collection
      const q = query(collection(db, "users"), where("email", "==", email));
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No user found with this email.");
        return;
      }

      // Assuming there is only one user with this email
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Compare the entered password with the hashed password stored in Firestore
      const isPasswordCorrect = await bcrypt.compare(password, userData.password);

      if (isPasswordCorrect) {
        // Successful login
        alert("Login successful!");
        navigate("/home");  // Redirect to home page after successful login
      } else {
        alert("Incorrect password.");
      }
    } catch (error) {
      console.error("Error logging in: ", error);
      alert("Error logging in.");
    }
  };

  const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // You can optionally save user info to Firestore here if needed
    navigate("/home");
  } catch (error) {
    console.error("Error with Google Sign-in: ", error);
    alert("Google Sign-in failed!");
  }
};

const handleFacebookLogin = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    // You can optionally save user info to Firestore here if needed
    navigate("/home");
  } catch (error) {
    console.error("Error with Facebook Sign-in: ", error);
    alert("Facebook Sign-in failed!");
  }
};

  return (
    <div className="loginpage-hero-container">
      {/* Background Image */}
      <div className="loginpage-background-image"></div>

      <div className="loginpage-background-overlay"></div>

      <div className="loginpage-main-content">
        <BackButton />

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
            Don’t Have an Account?{" "}
            <span onClick={() => navigate("/signup")}>Sign up</span>
          </p>

          <div className="loginpage-social-signin">
            <button className="loginpage-social-btn" onClick={handleGoogleLogin}>
              Sign in with Google
            </button>
            <button className="loginpage-social-btn" onClick={handleFacebookLogin}>
              Sign in with Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
