const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3/";

export const searchTMDb = async (query) => {
  const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results;
};

export const getDetails = async (mediaType, id) => {
  const res = await fetch(`${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}&append_to_response=videos,credits`);
  return await res.json();
};


console.log("TMDb API Key is:", import.meta.env.VITE_TMDB_API_KEY);
