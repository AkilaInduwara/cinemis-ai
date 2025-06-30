import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/HomePage.css";
import BackButton from "../Components/BackButton"; // Assuming you have BackButton component
import { auth } from "../firebase-config"; // Firebase Auth
import { signOut } from "firebase/auth"; // Firebase signOut function
import { db, storage } from "../firebase-config"; // Firestore and Firebase Storage
import { doc, getDoc } from "firebase/firestore"; // Firestore functions
import { ref, uploadBytes } from "firebase/storage"; // Firebase Storage functions

const HomePage = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null); // To store user details from Firestore
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up an auth state listener to capture the user when they log in
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Fetch user details from Firestore using the current user UID
        const fetchUserDetails = async () => {
          try {
            const userRef = doc(db, "users", currentUser.uid); // Use user UID to fetch data
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              setUserDetails(userDoc.data()); // Set user details from Firestore
            } else {
              console.log("No user found in Firestore");
            }
          } catch (error) {
            console.error("Error fetching user details: ", error);
          }
        };

        fetchUserDetails();
      } else {
        setUser(null); // Clear user state if the user is logged out
        setUserDetails(null);
      }
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out the user from Firebase
      alert("You have logged out.");
      navigate("/"); // Redirect to StartPage after logout
    } catch (error) {
      console.error("Error logging out: ", error);
      alert("Logout failed!");
    }
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === "video" && file.size > 50 * 1024 * 1024) {
        alert("Video file is too large. Maximum size is 50MB.");
        return;
      }
      if (type === "audio" && file.size > 10 * 1024 * 1024) {
        alert("Audio file is too large. Maximum size is 10MB.");
        return;
      }
      if (type === "video") {
        setVideoFile(file);
      } else if (type === "audio") {
        setAudioFile(file);
      }
    }
  };

  const handleFileUpload = async (type) => {
    if (!user) {
      alert("You must be logged in to upload files.");
      return;
    }
    if (type === "video" && !videoFile) {
      alert("Please select a video file to upload.");
      return;
    }
    if (type === "audio" && !audioFile) {
      alert("Please select an audio file to upload.");
      return;
    }

    setUploading(true);

    try {
      const storageRef = ref(storage, `${type}/${user.uid}_${Date.now()}.${type === "video" ? "mp4" : "mp3"}`);
      const file = type === "video" ? videoFile : audioFile;
      await uploadBytes(storageRef, file);

      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading file: ", error);
      alert("Error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="homepage-hero-container">
      {/* Background Image */}
      <div className="homepage-background-image"></div>

      <div className="homepage-background-overlay"></div>

      <div className="homepage-main-content">
        <BackButton /> {/* Back button component */}

        <h1 className="homepage-logo">CineMIS AI</h1>
        <p className="homepage-tagline">Find your Movie with us</p>

        {/* User account logo */}
        <div className="user-logo-container" onClick={toggleDropdown}>
          <img
            src={user ? user.photoURL : "src/Images/default-avatar.png"} // Display user photo or default image
            alt="User Logo"
            className="user-logo"
          />
          {dropdownVisible && (
            <div className="dropdown-menu">
              <p className="dropdown-item">
                Name: {userDetails ? userDetails.name : "Loading..."}
              </p>
              <p className="dropdown-item">
                Email: {userDetails ? userDetails.email : "Loading..."}
              </p>
              <button className="dropdown-item logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>

        <div className="homepage-search-container">
          <input
            type="text"
            placeholder="Enter plot details, a dialogue or movie details"
            className="homepage-search-bar"
          />
          <button className="homepage-search-btn">Search</button>
        </div>

        {/* File Upload for Video */}
        <div className="homepage-upload-container">
          <input
            type="file"
            accept="video/mp4"
            onChange={(e) => handleFileChange(e, "video")}
            className="file-input"
          />
          <button
            className="homepage-upload-btn"
            onClick={() => handleFileUpload("video")}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload VIDEO"}
          </button>
        </div>

        {/* File Upload for Audio */}
        <div className="homepage-upload-container">
          <input
            type="file"
            accept="audio/mp3"
            onChange={(e) => handleFileChange(e, "audio")}
            className="file-input"
          />
          <button
            className="homepage-upload-btn"
            onClick={() => handleFileUpload("audio")}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload AUDIO"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
