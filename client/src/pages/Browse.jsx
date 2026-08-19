import { useEffect, useState } from "react";
import { fetchCategories } from "../services/api.js";
import CategoryGrid from "../components/CategoryGrid/CategoryGrid.jsx";

export default function Browse() {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetchCategories()
      .then((data) => {
        setCategories(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1 className="page-heading" style={{ marginBottom: 20 }}>
        Browse
      </h1>

      {status === "loading" && <p className="status-text">Loading playlists...</p>}
      {status === "error" && (
        <p className="status-text">
          Couldn't load playlists. Make sure the server is running and YOUTUBE_API_KEY is set.
        </p>
      )}
      {status === "ready" && <CategoryGrid categories={categories} />}
    </div>
  );
}
