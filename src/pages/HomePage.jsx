import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../css/HomePage.css";
import BackButton from "../Components/BackButton";
import { supabase } from "../supabaseClient";
import dayjs from "dayjs";
import { searchTMDb, getDetails } from "../api/tmdbApi";

const HomePage = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState([]); // Add this line for uploads state
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchMode, setSearchMode] = useState("title"); // New state
  const [clipTranscript, setClipTranscript] = useState("");
  const [clipModel, setClipModel] = useState("");
  const [clipLoadingUrl, setClipLoadingUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0); // Upload progress
  const [uploadingFileName, setUploadingFileName] = useState(""); // File name for uploading
  const [progressPopupVisible, setProgressPopupVisible] = useState(false); // Control progress popup visibility
  const [clipProgress, setClipProgress] = useState(0); // Progress for identifying
  const [isIdentifying, setIsIdentifying] = useState(false); // Track identifying state
  const [isIdentifyingCancelled, setIsIdentifyingCancelled] = useState(false); // Cancel identifying state
  const identifyIntervalRef = useRef(null); // NEW: holds progress interval id
  const identifyAbortRef = useRef(null); // NEW: holds AbortController

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

    try {
      const { data, error } = await supabase
        .from("media_uploads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }) // Make sure `created_at` exists
        .limit(1);

      if (error) {
        console.error("Fetch error:", error); // This will log any error related to fetching
        alert("Error fetching uploads: " + error.message);
      } else {
        console.log("Fetched uploads:", data); // Log data to verify it works correctly
        setUploads(data);
      }
    } catch (err) {
      console.error("Error fetching uploads:", err);
      alert("An error occurred while fetching uploads.");
    }
  };

  const identifyUpload = async (u) => {
    // derive a display name from URL for the popup title
    const nameFromUrl = (u?.file_url || "").split("/").pop() || "clip";
    // reset UI
    setClipTranscript("");
    setClipModel("");
    setResults([]);
    setClipLoadingUrl(u.file_url);
    setUploadingFileName(nameFromUrl);

    // set up identifying state
    setIsIdentifying(true);
    setIsIdentifyingCancelled(false);
    setClipProgress(0);

    // progress ticker: climb slowly to 95% while waiting on backend
    if (identifyIntervalRef.current) {
      clearInterval(identifyIntervalRef.current);
    }
    identifyIntervalRef.current = setInterval(() => {
      setClipProgress((p) => (p < 95 ? p + 1 : 95));
    }, 120); // ~12s to reach 95%

    // abort controller (for cancel)
    const controller = new AbortController();
    identifyAbortRef.current = controller;

    try {
      const resp = await fetch("http://localhost:8000/identify-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u.file_url, type: u.type, top_k: 5 }),
        signal: controller.signal, // <- allow cancel
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Identify failed (${resp.status})`);
      }

      const data = await resp.json();
      setClipTranscript(data.transcript || "");
      setClipModel(data.model_used || "");
      setResults(data.results || []);

      // jump to 100% to trigger auto-close
      setClipProgress(100);
    } catch (e) {
      if (e.name === "AbortError") {
        // cancelled by user
        console.warn("Identification aborted by user");
      } else {
        console.error(e);
        alert(e.message || "Identify failed");
      }
      // ensure popup closes on error/cancel
      setClipProgress(100);
    } finally {
      setClipLoadingUrl(null);
      if (identifyIntervalRef.current) {
        clearInterval(identifyIntervalRef.current);
        identifyIntervalRef.current = null;
      }
    }
  };

  const cancelIdentification = () => {
    setIsIdentifyingCancelled(true);
    if (identifyAbortRef.current) {
      try {
        identifyAbortRef.current.abort();
      } catch {}
    }
    if (identifyIntervalRef.current) {
      clearInterval(identifyIntervalRef.current);
      identifyIntervalRef.current = null;
    }
    // Set to 100 so the auto-close effect runs
    setClipProgress(100);
  };

  useEffect(() => {
    return () => {
      if (identifyIntervalRef.current) {
        clearInterval(identifyIntervalRef.current);
        identifyIntervalRef.current = null;
      }
      if (identifyAbortRef.current) {
        try {
          identifyAbortRef.current.abort();
        } catch {}
        identifyAbortRef.current = null;
      }
    };
  }, []);

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
    setUploadingFileName(file.name);
    setProgressPopupVisible(true); // Show the progress popup

    const ext = file.name.split(".").pop();
    const filePath = `${type}s/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(`${type}s`)
      .upload(filePath, file, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
          );
          setUploadProgress(percent); // Update progress bar
        },
      });

    if (uploadError) {
      console.error(`${type} upload failed:`, uploadError);
      alert(`${type.toUpperCase()} upload failed.`);
      setUploading(false);
      setProgressPopupVisible(false); // Hide progress popup
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
      fetchUploads(); // Refresh file list
    }

    setUploading(false);
    setUploadProgress(0);
    setProgressPopupVisible(false); // Hide the popup when upload is complete
  };

  // Optionally, fetch uploads when user changes or after upload
  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

  useEffect(() => {
    console.log("Fetched user details:", userDetails);
  }, [userDetails]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoadingResults(true);

    if (searchMode === "title") {
      // TMDB Title Search (Option 4)
      const rawResults = await searchTMDb(query);

      if (!Array.isArray(rawResults)) {
        console.error("TMDB returned invalid data:", rawResults);
        setResults([]);
        setLoadingResults(false);
        return;
      }

      const enriched = await Promise.all(
        rawResults.slice(0, 5).map(async (item) => {
          try {
            const details = await getDetails(item.media_type, item.id);
            return { ...item, details };
          } catch (e) {
            console.warn("Failed to enrich TMDB item:", item);
            return null;
          }
        })
      );

      setResults(enriched.filter(Boolean));
    } else {
      // Local FAISS Plot Search (Option 3)
      try {
        const response = await fetch("http://localhost:8000/search-plot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, top_k: 5 }),
        });

        const data = await response.json();
        setResults(data.results || []);
      } catch (err) {
        console.error("Plot search failed:", err);
        setResults([]);
      }
    }

    setLoadingResults(false);
  };

  // NEW: auto-close identifying popup once progress reaches 100
  useEffect(() => {
    if (isIdentifying && clipProgress >= 100) {
      // small delay so user sees 100%
      const t = setTimeout(() => {
        setIsIdentifying(false);
        setIsIdentifyingCancelled(false);
        // cleanup
        if (identifyIntervalRef.current) {
          clearInterval(identifyIntervalRef.current);
          identifyIntervalRef.current = null;
        }
        identifyAbortRef.current = null;
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isIdentifying, clipProgress]);

  // clears UI only (not DB)
  const clearAll = () => {
    // stop any in-flight identify
    if (identifyAbortRef.current) {
      try {
        identifyAbortRef.current.abort();
      } catch {}
      identifyAbortRef.current = null;
    }
    if (identifyIntervalRef.current) {
      clearInterval(identifyIntervalRef.current);
      identifyIntervalRef.current = null;
    }

    // reset states
    setIsIdentifying(false);
    setIsIdentifyingCancelled(false);
    setClipProgress(0);
    setProgressPopupVisible(false);

    setQuery("");
    setSearchMode("title"); // back to default mode
    setResults([]);
    setClipTranscript("");
    setClipModel("");
    setClipLoadingUrl(null);
    setUploadingFileName("");
    setUploadType("");
    setUploadProgress(0);

    // clear local selections & on-page “recent uploads” list
    setSelectedVideo(null);
    setSelectedAudio(null);
    setVideoFile(null);
    setAudioFile(null);
    setUploads([]); // UI-only; does not touch DB

    // optional: scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="homepage-hero-container">
      <div className="homepage-background-image" />
      <div className="homepage-background-overlay" />

      {/* Hero Section */}
      <section className="homepage-hero-section">
        <div className="homepage-main-content">
          <BackButton
            onBackConfirm={async () => {
              const confirmLogout = window.confirm("Do you want to Logout?");
              if (confirmLogout) {
                await supabase.auth.signOut();
                alert("You have logged out.");
                navigate("/");
                return false;
              }
              return false;
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

          <div className="search-mode-toggle">
            <button
              className={`toggle-btn ${searchMode === "title" ? "active" : ""}`}
              onClick={() => setSearchMode("title")}
            >
              🔍 Title Search
            </button>
            <button
              className={`toggle-btn ${searchMode === "plot" ? "active" : ""}`}
              onClick={() => setSearchMode("plot")}
            >
              🧠 Plot Search
            </button>
          </div>

          <div className="homepage-search-container">
            <input
              type="text"
              placeholder="Enter plot details, a dialogue or movie details"
              className="homepage-search-bar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="homepage-search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>

          <div className="upload-section">
            {/* VIDEO */}
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

            {/* AUDIO */}
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

          {(videoFile || audioFile) && (
            <div className="uploaded-files">
              <h3>Your uploads</h3>
              <ul>
                {uploads.slice(0, 6).map((u) => (
                  <li key={u.id || u.file_url}>
                    <a href={u.file_url} target="_blank" rel="noreferrer">
                      {u.type.toUpperCase()} — {u.file_url.split("/").pop()}
                    </a>{" "}
                    <button
                      className="upload-action-btn-outside"
                      onClick={() => identifyUpload(u)}
                      disabled={!!clipLoadingUrl}
                      style={{ marginLeft: 8 }}
                    >
                      {clipLoadingUrl === u.file_url
                        ? "Identifying..."
                        : "Identify"}
                    </button>
                  </li>
                ))}
              </ul>

              {(clipTranscript || clipModel) && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 12,
                  }}
                >
                  <div>
                    <strong>Model:</strong> {clipModel}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <strong>Transcript:</strong>
                    <div
                      style={{
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                        color: "#ddd",
                      }}
                    >
                      {clipTranscript}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isIdentifying && !isIdentifyingCancelled && (
            <div className="process-progress-popup">
              <div className="popup-content">
                <h3>Identifying: {uploadingFileName}</h3>
                <progress
                  value={clipProgress}
                  max="100"
                  className="process-progress-bar"
                  style={{ width: "100%", margin: "12px 0" }}
                ></progress>
                <p>{clipProgress}%</p>
                <button
                  className="cancel-btn"
                  onClick={cancelIdentification}
                  disabled={clipProgress >= 100}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}

      <section className="homepage-results-section">
        {(results.length > 0 ||
          !!clipTranscript ||
          !!clipModel ||
          !!clipLoadingUrl ||
          loadingResults) && (
          <div
            style={{
              maxWidth: 1000,
              margin: "0 auto 16px",
              padding: "0 20px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button className="upload-action-btn-outside" onClick={clearAll}>
              Clear results
            </button>
          </div>
        )}

        {loadingResults && (
          <p style={{ color: "white", textAlign: "center" }}>Loading...</p>
        )}
        {loadingResults && (
          <p style={{ color: "white", textAlign: "center" }}>Loading...</p>
        )}
        {loadingResults && (
          <p style={{ color: "white", textAlign: "center" }}>Loading...</p>
        )}

        {results.length > 0 && (
          <div className="results-container">
            {results.map((item, index) => {
              const isTMDB = !!item.details;

              if (isTMDB) {
                // TMDB (title) result
                const info = item.details;
                const poster = info.poster_path
                  ? `https://image.tmdb.org/t/p/w300${info.poster_path}`
                  : "https://image.tmdb.org/t/p/w300_and_h450_bestv2//t/p/w300/no_image_available.jpg";

                const trailer = info.videos?.results?.find(
                  (v) => v.type === "Trailer"
                );

                return (
                  <div key={index} className="result-card">
                    <img src={poster} alt="poster" />
                    <div className="result-details">
                      <h3>{info.title || info.name}</h3>
                      <p>
                        <strong>Genres:</strong>{" "}
                        {info.genres.map((g) => g.name).join(", ")}
                      </p>
                      <p>
                        <strong>Overview:</strong> {info.overview}
                      </p>
                      <p>
                        <strong>Cast:</strong>{" "}
                        {info.credits?.cast
                          ?.slice(0, 5)
                          .map((c) => c.name)
                          .join(", ")}
                      </p>
                      {trailer && (
                        <a
                          href={`https://youtube.com/watch?v=${trailer.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ▶️ Watch Trailer
                        </a>
                      )}
                    </div>
                  </div>
                );
              } else {
                // FAISS (plot) result
                return (
                  <div key={index} className="result-card">
                    <img
                      src={
                        item.poster ||
                        "https://image.tmdb.org/t/p/w300_and_h450_bestv2//t/p/w300/no_image_available.jpg"
                      }
                      alt="poster"
                    />
                    <div className="result-details">
                      <h3>
                        {item.title} ({item.year})
                      </h3>
                      <p>
                        <strong>Genres:</strong> {item.genre}
                      </p>
                      <p>
                        <strong>Overview:</strong> {item.overview}
                      </p>
                      {item.trailer && (
                        <a
                          href={item.trailer}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ▶️ Watch Trailer
                        </a>
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}

        {!loadingResults && results.length === 0 && query && (
          <p style={{ color: "white", textAlign: "center" }}>
            No results found for "{query}"
          </p>
        )}
      </section>

      {progressPopupVisible && (
        <div className="upload-progress-popup">
          <div className="popup-content">
            <h3>
              Uploading:{" "}
              <span style={{ color: "#00e0b8" }}>{uploadingFileName}</span>
            </h3>
            <progress
              value={uploadProgress}
              max="100"
              className="upload-progress-bar"
              style={{ width: "100%", margin: "12px 0" }}
            ></progress>
            <p style={{ color: "#fff", fontWeight: "bold" }}>
              {uploadProgress}%
            </p>
            <p style={{ color: "#ccc", fontSize: "0.95rem" }}>
              Please wait while your file is being uploaded...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
