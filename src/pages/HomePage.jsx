import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/HomePage.css";
import BackButton from "../Components/BackButton";
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";

const HomePage = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState([]); // Add this line for uploads state
  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      console.log("Session:", session); // ✅ debug
      console.log("Error:", error); // ✅ debug

      if (session?.user) {
        setUser(session.user);
        console.log("User metadata:", session.user.user_metadata); // ✅ Add this
        fetchUserDetails(session.user.id);
      }

      // Re-check session on any auth state change
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchUserDetails(session.user.id);
        } else {
          setUser(null);
          setUserDetails(null);
        }
      });
    };

    init();
  }, []);

  const fetchUserDetails = async (userId) => {
    // Early return if user is not set yet
    if (!userId) return;

    // Fetch from your custom users table
    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUserDetails(data);
    } else if (!data && !error) {
      // only insert if data is null AND there's no error
      const currentUser = await supabase.auth.getUser();
      const userMeta = currentUser?.data?.user?.user_metadata || {};
      const name = userMeta?.name || userMeta?.full_name || "Anonymous";
      const email = currentUser?.data?.user?.email;
      const avatar_url = userMeta?.avatar_url || null;

      const { data: insertData, error: insertError } = await supabase
        .from("users")
        .insert([
          {
            id: userId,
            name,
            email,
            avatar_url,
            created_at: dayjs().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting new user:", insertError);
      } else {
        setUserDetails(insertData);
      }
    } else {
      console.error("Error fetching user:", error);
    }
  };

  const fetchUploads = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("media_uploads")
      .select("*")
      .eq("user_id", user.id);

    if (error) console.error("Fetch error:", error);
    else setUploads(data);
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

  const handleFileUpload = async (type, file) => {
    if (!user || !file) return;

    setUploading(true);
    setUploadProgress(0);

    const ext = file.name.split(".").pop();
    const filePath = `${type}s/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(`${type}s`)
      .upload(filePath, file, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
          );
          setUploadProgress(percent);
        },
      });

    if (uploadError) {
      console.error(`${type} upload failed:`, uploadError);
      alert(`${type.toUpperCase()} upload failed.`);
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage
      .from(`${type}s`)
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    const { error: dbError } = await supabase.from("media_uploads").insert([
      {
        user_id: user.id,
        file_url: publicUrl,
        type,
      },
    ]);

    if (dbError) {
      console.error("DB insert error:", dbError);
      alert("Upload succeeded, but DB insert failed.");
    } else {
      alert(`${type.toUpperCase()} uploaded and saved to database!`);
      fetchUploads(); // refresh file list
    }

    setUploading(false);
    setUploadProgress(0);
  };

  // Optionally, fetch uploads when user changes or after upload
  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

  useEffect(() => {
    console.log("Fetched user details:", userDetails);
  }, [userDetails]);

  return (
    <div className="homepage-hero-container">
      <div className="homepage-background-image"></div>
      <div className="homepage-background-overlay"></div>

      <div className="homepage-main-content">
        <BackButton
          onBackConfirm={async () => {
            const confirmLogout = window.confirm("Do you want to LogOut?");
            if (confirmLogout) {
              await supabase.auth.signOut();
              alert("You have logged out.");
              navigate("/");
              return false; // prevent history navigation
            }
            return false; // don't navigate back
          }}
        />

        <h1 className="homepage-logo">CineMIS AI</h1>
        <p className="homepage-tagline">Find your Movie with us</p>

        <div className="user-logo-container" onClick={toggleDropdown}>
          <img
            src={
              userDetails?.avatar_url ||
              user?.user_metadata?.avatar_url ||
              "src/Images/default-avatar.png"
            }
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

        <div className="upload-section">
          <div className="upload-row">
            <div
              className="upload-card dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  setVideoFile(file);
                  setSelectedVideo(file);
                }
              }}
            >
              <p>📹 Drag & Drop Video</p>
              <input
                type="file"
                accept="video/mp4"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setVideoFile(file);
                    setSelectedVideo(file);
                  }
                }}
              />
              {selectedVideo && (
                <p className="selected-file">{selectedVideo.name}</p>
              )}
            </div>

            {selectedVideo && (
              <>
                <button
                  className="delete-btn-outside"
                  onClick={() => {
                    setVideoFile(null);
                    setSelectedVideo(null);
                  }}
                >
                  ❌
                </button>
                <button
                  className="upload-action-btn-outside"
                  onClick={() => {
                    setUploadType("video");
                    handleFileUpload("video", selectedVideo);
                    setSelectedVideo(null);
                  }}
                  disabled={uploading}
                >
                  {uploading && uploadType === "video"
                    ? "Uploading..."
                    : "Upload"}
                </button>
              </>
            )}
          </div>

          {uploadType === "video" && uploading && (
            <progress
              value={uploadProgress}
              max="100"
              className="upload-progress"
            />
          )}

          <div className="upload-row">
            <div
              className="upload-card dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  setAudioFile(file);
                  setSelectedAudio(file);
                }
              }}
            >
              <p>🎧 Drag & Drop Audio</p>
              <input
                type="file"
                accept="audio/mp3"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setAudioFile(file);
                    setSelectedAudio(file);
                  }
                }}
              />
              {selectedAudio && (
                <p className="selected-file">{selectedAudio.name}</p>
              )}
            </div>

            {selectedAudio && (
              <>
                <button
                  className="delete-btn-outside"
                  onClick={() => {
                    setAudioFile(null);
                    setSelectedAudio(null);
                  }}
                >
                  ❌
                </button>

                <button
                  className="upload-action-btn-outside"
                  onClick={() => {
                    setUploadType("audio");
                    handleFileUpload("audio", selectedAudio);
                    setSelectedAudio(null);
                  }}
                  disabled={uploading}
                >
                  {uploading && uploadType === "audio"
                    ? "Uploading..."
                    : "Upload"}
                </button>
              </>
            )}
          </div>

          {uploadType === "audio" && uploading && (
            <progress
              value={uploadProgress}
              max="100"
              className="upload-progress"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
