import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext.jsx";
import {
  LIKED_PLAYLIST_ID,
  deletePlaylist,
  getPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
} from "../utils/playlists.js";
import TrackCard from "../components/TrackCard/TrackCard.jsx";

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const [playlist, setPlaylist] = useState(() => getPlaylist(id));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setPlaylist(getPlaylist(id));
  }, [id]);

  function refresh() {
    setPlaylist(getPlaylist(id));
  }

  function handleRemove(videoId) {
    removeTrackFromPlaylist(id, videoId);
    refresh();
  }

  function handlePlayAll() {
    if (playlist.tracks.length > 0) playTrack(playlist.tracks[0], playlist.tracks);
  }

  function startRename() {
    setName(playlist.name);
    setRenaming(true);
  }

  function submitRename(e) {
    e.preventDefault();
    renamePlaylist(id, name);
    setRenaming(false);
    refresh();
  }

  function handleDelete() {
    if (!window.confirm(`Delete playlist "${playlist.name}"? This can't be undone.`)) return;
    deletePlaylist(id);
    navigate("/library");
  }

  if (!playlist) {
    return (
      <div>
        <p className="empty-state">Playlist not found.</p>
      </div>
    );
  }

  const isLikedPlaylist = id === LIKED_PLAYLIST_ID;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        {renaming ? (
          <form onSubmit={submitRename} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              style={{
                fontSize: 22,
                fontFamily: "var(--font-heading)",
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: 10,
                padding: "6px 12px",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </form>
        ) : (
          <h1
            className="page-heading"
            onClick={() => !isLikedPlaylist && startRename()}
            style={{ cursor: isLikedPlaylist ? "default" : "pointer", marginBottom: 8 }}
            title={isLikedPlaylist ? undefined : "Click to rename"}
          >
            {playlist.id === LIKED_PLAYLIST_ID && <span aria-hidden="true">♥ </span>}
            {playlist.name}
          </h1>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
          </span>
          {playlist.tracks.length > 0 && (
            <button className="btn btn-primary" onClick={handlePlayAll}>
              ▶ Play All
            </button>
          )}
          {!isLikedPlaylist && (
            <button
              className="icon-btn"
              onClick={handleDelete}
              aria-label="Delete playlist"
              title="Delete playlist"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {playlist.tracks.length === 0 ? (
        <p className="empty-state">
          Nothing here yet. Use the + button on any track to add it to this playlist.
        </p>
      ) : (
        <div className="grid">
          {playlist.tracks.map((track) => (
            <TrackCard
              key={track.videoId}
              track={track}
              queue={playlist.tracks}
              onRemoveFromPlaylist={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
