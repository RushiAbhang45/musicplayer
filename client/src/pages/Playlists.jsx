import { useState } from "react";
import { createPlaylist, getPlaylists } from "../utils/playlists.js";
import PlaylistCard from "../components/PlaylistCard/PlaylistCard.jsx";

export default function Playlists() {
  const [playlists, setPlaylists] = useState(() => getPlaylists());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

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

      <div className="grid">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
      </div>
    </div>
  );
}
