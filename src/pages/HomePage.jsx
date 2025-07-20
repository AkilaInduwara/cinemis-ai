import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/HomePage.css";
import BackButton from "../Components/BackButton";
import { supabase } from "../supabaseClient";

const HomePage = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchUserDetails(session.user.id);
      }
    };

    fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchUserDetails(session.user.id);
        } else {
          setUser(null);
          setUserDetails(null);
        }
      }
    );

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const fetchUserDetails = async (userId) => {
    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!data && user) {
      const userMeta = user.user_metadata || {};
      const name = userMeta.name || "Anonymous";
      const email = user.email;

      const { data: insertData, error: insertError } = await supabase
        .from("users")
        .insert([{ id: userId, name, email }])
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting new user:", insertError);
      } else {
        setUserDetails(insertData);
      }
    } else if (data) {
      setUserDetails(data);
    } else {
      console.error("Error fetching user:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert("You have logged out.");
    navigate("/");
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === "video" && file.size > 50 * 1024 * 1024) {
      alert("Video too large. Max 50MB.");
      return;
    }

    if (type === "audio" && file.size > 10 * 1024 * 1024) {
      alert("Audio too large. Max 10MB.");
      return;
    }

    if (type === "video") setVideoFile(file);
    else setAudioFile(file);
  };

  const handleFileUpload = async (type) => {
    if (!user) {
      alert("Login first.");
      return;
    }

    const file = type === "video" ? videoFile : audioFile;
    if (!file) {
      alert(`Please select a ${type} file.`);
      return;
    }

    setUploading(true);

    const filePath = `${type}/${user.id}_${Date.now()}.${
      type === "video" ? "mp4" : "mp3"
    }`;
    const { error } = await supabase.storage
      .from(`${type}s`)
      .upload(filePath, file);

    if (error) {
      console.error(error);
      alert("Upload failed.");
    } else {
      alert(`${type.toUpperCase()} uploaded successfully!`);
    }

    setUploading(false);
  };

  return (
    <div className="homepage-hero-container">
      <div className="homepage-background-image"></div>
      <div className="homepage-background-overlay"></div>

      <div className="homepage-main-content">
        <BackButton />
        <h1 className="homepage-logo">CineMIS AI</h1>
        <p className="homepage-tagline">Find your Movie with us</p>

        <div className="user-logo-container" onClick={toggleDropdown}>
          <img
            src="src/Images/default-avatar.png"
            alt="User Logo"
            className="user-logo"
          />
          {dropdownVisible && (
            <div className="dropdown-menu">
              <p className="dropdown-item">
                Name: {userDetails?.name || "Loading..."}
              </p>
              <p className="dropdown-item">
                Email: {userDetails?.email || "Loading..."}
              </p>
              <button
                className="dropdown-item logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
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
