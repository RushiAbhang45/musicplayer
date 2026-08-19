import { useEffect, useState } from "react";
import {
  createPlaylist,
  getPlaylists,
  isPlaylistsLoading,
  subscribeToPlaylistChanges,
} from "../utils/playlists.js";
import { fetchCategories } from "../services/api.js";
import PlaylistCard from "../components/PlaylistCard/PlaylistCard.jsx";
import CategoryGrid from "../components/CategoryGrid/CategoryGrid.jsx";

export default function Playlists() {
  const [playlists, setPlaylists] = useState(() => getPlaylists());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState("loading");

  useEffect(() => {
    setPlaylists(getPlaylists());
    return subscribeToPlaylistChanges(() => setPlaylists(getPlaylists()));
  }, []);

  useEffect(() => {
    fetchCategories()
      .then((data) => {
        setCategories(data);
        setCategoriesStatus("ready");
      })
      .catch(() => setCategoriesStatus("error"));
  }, []);

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    createPlaylist(name);
    setName("");
    setCreating(false);
    setPlaylists(getPlaylists());
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1 className="page-heading" style={{ marginBottom: 0 }}>
          Your Library
        </h1>
        {creating ? (
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Playlist name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-card"
              style={{
                padding: "10px 14px",
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </form>
        ) : (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New Playlist
          </button>
        )}
      </div>

      {isPlaylistsLoading() ? (
        <p className="status-text">Loading your library...</p>
      ) : (
        <div className="grid">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}

      <h2 className="page-heading" style={{ fontSize: 20, margin: "36px 0 14px" }}>
        Browse Playlists
      </h2>
      {categoriesStatus === "loading" && <p className="status-text">Loading playlists...</p>}
      {categoriesStatus === "error" && (
        <p className="status-text">Couldn't load playlists right now.</p>
      )}
      {categoriesStatus === "ready" && <CategoryGrid categories={categories} />}
    </div>
  );
}
