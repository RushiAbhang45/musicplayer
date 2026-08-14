import { useEffect, useState } from "react";
import { fetchCategories } from "../services/api.js";
import CategoryGrid from "../components/CategoryGrid/CategoryGrid.jsx";

export default function Home() {
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
      <section style={{ marginBottom: 36 }}>
        <h1 className="page-heading gradient-text">Every hit, one place.</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
          Sufi &amp; romance, party anthems, throwback decades, and whatever else you can find on
          YouTube — pick a playlist or search for anything.
        </p>
      </section>

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
