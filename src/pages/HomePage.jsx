// HomePage.jsx
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
  const [results, setResults] = useState([]);               // fused top (combined)
  const [rawOverview, setRawOverview] = useState([]);       // overview-only hits
  const [rawSubtitles, setRawSubtitles] = useState([]);     // subtitle-only hits
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchMode, setSearchMode] = useState("title"); // New state

  // keep in state (for dev) but DO NOT render on page
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
      console.log("[Auth] Session:", session);
      console.log("[Auth] Error:", error);

      if (session?.user) {
        setUser(session.user);
        console.log("[Auth] User metadata:", session.user.user_metadata);
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
    if (!userId) return;

    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUserDetails(data);
    } else if (!data && !error) {
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
        console.error("[DB] Insert user failed:", insertError.message);
      } else {
        setUserDetails(insertData);
      }
    } else {
      console.error("[DB] Fetch user error:", error);
    }
  };

  const fetchUploads = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("media_uploads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("[DB] Fetch uploads error:", error);
        alert("Error fetching uploads: " + error.message);
      } else {
        console.log("[DB] Fetched uploads:", data);
        setUploads(data);
      }
    } catch (err) {
      console.error("[DB] Fetch uploads exception:", err);
      alert("An error occurred while fetching uploads.");
    }
  };

  const identifyUpload = async (u) => {
    const nameFromUrl = (u?.file_url || "").split("/").pop() || "clip";

    // reset UI state (results on page)
    setResults([]);
    setRawOverview([]);
    setRawSubtitles([]);
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

    // DEBUG LOGS — outbound request
    console.log("[Identify] Starting identification:");
    console.log("  • URL:", u.file_url);
    console.log("  • Type:", u.type);
    console.log("  • Endpoint:", "http://localhost:8000/identify-from-url");
    console.log("  • Body:", { url: u.file_url, type: u.type, top_k: 5 });

    try {
      const resp = await fetch("http://localhost:8000/identify-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u.file_url, type: u.type, top_k: 5 }),
        signal: controller.signal,
      });

      console.log("[Identify] Response status:", resp.status);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error("[Identify] Error payload:", err);
        throw new Error(err.detail || `Identify failed (${resp.status})`);
      }

      const data = await resp.json();

      // DEBUG LOGS — backend returned fields
      console.log("[Identify] Success payload keys:", Object.keys(data));
      console.log("[Identify] ASR model:", data.model_used);
      console.log("[Identify] Transcript (first 300 chars):", (data.transcript || "").slice(0, 300));
      console.log("[Identify] Fused results length:", Array.isArray(data.fused_top) ? data.fused_top.length : 0);
      console.log("[Identify] TMDB overview results length:", Array.isArray(data.tmdb_overview_results) ? data.tmdb_overview_results.length : 0);
      console.log("[Identify] Subtitle candidates length:", Array.isArray(data.subtitle_candidates) ? data.subtitle_candidates.length : 0);

      // Keep transcript & model ONLY IN CONSOLE (still store in state for dev)
      setClipTranscript(data.transcript || "");
      setClipModel(data.model_used || "");

      // show results on page
      setResults(data.fused_top || data.results || []);
      setRawOverview(Array.isArray(data.tmdb_overview_results) ? data.tmdb_overview_results : []);
      setRawSubtitles(Array.isArray(data.subtitle_candidates) ? data.subtitle_candidates : []);

      // pretty tables for quick inspection
      if (Array.isArray(data.fused_top)) {
        console.log("[Identify] Fused top:");
        console.table(
          data.fused_top.map((r) => ({
            title: r.details ? (r.details.title || r.details.name) : r.title,
            year: r.details ? (r.details.release_date || r.details.first_air_date || "") : r.year,
            source: r.details ? "TMDB" : "Overview FAISS",
            score: typeof r.score !== "undefined" ? r.score : "",
          }))
        );
      }
      if (Array.isArray(data.subtitle_candidates)) {
        console.log("[Identify] Subtitle candidates (first 10):");
        console.table(
          data.subtitle_candidates.slice(0, 10).map((s) => ({
            title: s.title || s.title_guess || "Unknown",
            season: s.season ?? "",
            episode: s.episode ?? "",
            year: s.year || s.year_guess || "",
            score: s.score ?? "",
          }))
        );
      }

      // jump to 100% to trigger auto-close
      setClipProgress(100);
    } catch (e) {
      if (e.name === "AbortError") {
        console.warn("[Identify] Aborted by user");
      } else {
        console.error("[Identify] Exception:", e);
        alert(e.message || "Identify failed");
      }
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

    if (type === "video" && !file.type.startsWith("video/")) {
      alert("Please upload a valid video file.");
      return;
    }

    if (type === "audio" && !file.type.startsWith("audio/")) {
      alert("Please upload a valid audio file.");
      return;
    }

    if (type === "video" && file.size > 20 * 1024 * 1024) {
      alert("Video too large. Max 20MB.");
      return;
    }

    if (type === "audio" && file.size > 5 * 1024 * 1024) {
      alert("Audio too large. Max 5MB.");
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
    setProgressPopupVisible(true);

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
      console.error(`[Upload] ${type} upload failed:`, uploadError);
      alert(`${type.toUpperCase()} upload failed.`);
      setUploading(false);
      setProgressPopupVisible(false);
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
      console.error("[DB] Insert media_uploads error:", dbError);
      alert("Upload succeeded, but DB insert failed.");
    } else {
      alert(`${type.toUpperCase()} uploaded and saved to database!`);
      fetchUploads();
    }

    setUploading(false);
    setUploadProgress(0);
    setProgressPopupVisible(false);
  };

  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

  useEffect(() => {
    console.log("[DB] User details:", userDetails);
  }, [userDetails]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoadingResults(true);

    console.log("[Search] Mode:", searchMode, "| Query:", query);

    if (searchMode === "title") {
      const rawResults = await searchTMDb(query);

      if (!Array.isArray(rawResults)) {
        console.error("[Search] TMDB returned invalid data:", rawResults);
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
            console.warn("[Search] Failed to enrich TMDB item:", item);
            return null;
          }
        })
      );

      setResults(enriched.filter(Boolean));
      setRawOverview([]);
      setRawSubtitles([]);
      console.log("[Search] TMDB results:", enriched.filter(Boolean));
    } else {
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
        setRawOverview([]);
        setRawSubtitles([]);
        console.log("[Search] Local FAISS results:", data.results || []);
      } catch (err) {
        console.error("[Search] Plot search failed:", err);
        setResults([]);
        setRawOverview([]);
        setRawSubtitles([]);
      }
    }

    setLoadingResults(false);
  };

  useEffect(() => {
    if (isIdentifying && clipProgress >= 100) {
      const t = setTimeout(() => {
        setIsIdentifying(false);
        setIsIdentifyingCancelled(false);
        if (identifyIntervalRef.current) {
          clearInterval(identifyIntervalRef.current);
          identifyIntervalRef.current = null;
        }
        identifyAbortRef.current = null;
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isIdentifying, clipProgress]);

  const clearAll = () => {
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

    setIsIdentifying(false);
    setIsIdentifyingCancelled(false);
    setClipProgress(0);
    setProgressPopupVisible(false);

    setQuery("");
    setSearchMode("title");
    setResults([]);
    setRawOverview([]);
    setRawSubtitles([]);
    setClipTranscript("");
    setClipModel("");
    setClipLoadingUrl(null);
    setUploadingFileName("");
    setUploadType("");
    setUploadProgress(0);

    setSelectedVideo(null);
    setSelectedAudio(null);
    setVideoFile(null);
    setAudioFile(null);
    setUploads([]);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClearUpload = (type) => {
    if (type === "video") {
      setVideoFile(null);
      setSelectedVideo(null);
    } else {
      setAudioFile(null);
      setSelectedAudio(null);
    }
    setUploads([]);
  };

  const handleIdentifyUpload = (u) => {
    identifyUpload(u);
    setSelectedVideo(null);
    setSelectedAudio(null);
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
              placeholder="Enter plot details or a Title"
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
                    <button
                      className="clear-btn"
                      onClick={() => handleClearUpload(u.type)}
                      style={{ marginLeft: 8 }}
                    >
                      Clear
                    </button>
                  </li>
                ))}
              </ul>
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
          rawOverview.length > 0 ||
          rawSubtitles.length > 0 ||
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

        {/* Fused Results */}
        {results.length > 0 && (
          <div className="results-container">
            <h2 style={{ color: "#fff", textAlign: "left", margin: "10px 0 14px" }}>
              Top Matches (Fused)
            </h2>
            {results.map((item, index) => {
              const isTMDB = !!item.details;

              if (isTMDB) {
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

        {/* Overview Engine (TMDB) — raw */}
        {rawOverview.length > 0 && (
          <div className="results-container">
            <h2 style={{ color: "#fff", textAlign: "left", margin: "24px 0 14px" }}>
              Overview Engine (TMDB)
            </h2>
            {rawOverview.map((item, index) => {
              const isTMDB = !!item.details;

              if (isTMDB) {
                const info = item.details;
                const poster = info.poster_path
                  ? `https://image.tmdb.org/t/p/w300${info.poster_path}`
                  : "https://image.tmdb.org/t/p/w300_and_h450_bestv2//t/p/w300/no_image_available.jpg";

                const trailer = info.videos?.results?.find(
                  (v) => v.type === "Trailer"
                );

                return (
                  <div key={`ov_${index}`} className="result-card">
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
                return (
                  <div key={`ov_${index}`} className="result-card">
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

        {/* Subtitle Engine — raw (OpenSubtitles) */}
        {rawSubtitles.length > 0 && (
          <div className="results-container">
            <h2 style={{ color: "#fff", textAlign: "left", margin: "24px 0 14px" }}>
              Subtitle Engine (OpenSubtitles)
            </h2>
            {rawSubtitles.map((s, i) => (
              <div key={`subs_${i}`} className="result-card">
                <img
                  src="https://via.placeholder.com/180x270?text=Subtitles"
                  alt="subtitle"
                />
                <div className="result-details">
                  <h3>
                    {(s.title || s.title_guess || "Unknown Title")}
                    {s.season && s.episode
                      ? ` (S${String(s.season).padStart(2, "0")}E${String(s.episode).padStart(2, "0")})`
                      : ""}
                  </h3>
                  <p><strong>Year:</strong> {s.year || s.year_guess || "—"}</p>
                  {typeof s.score !== "undefined" && (
                    <p><strong>Score:</strong> {Number(s.score).toFixed ? Number(s.score).toFixed(4) : s.score}</p>
                  )}
                  {(s.source || s.inner_name) && (
                    <p>
                      <strong>Source:</strong> {s.source || "—"}{s.inner_name ? ` → ${s.inner_name}` : ""}
                    </p>
                  )}
                  {s.snippet && <p>{s.snippet}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingResults &&
          results.length === 0 &&
          rawOverview.length === 0 &&
          rawSubtitles.length === 0 &&
          query && (
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
