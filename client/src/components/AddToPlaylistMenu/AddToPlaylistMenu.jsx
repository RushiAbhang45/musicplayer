import { useState } from "react";
import { createPortal } from "react-dom";
import {
  addTrackToPlaylist,
  createPlaylist,
  getPlaylists,
  isTrackInPlaylist,
  removeTrackFromPlaylist,
} from "../../utils/playlists.js";
import "./AddToPlaylistMenu.css";

// Rendered via a portal into document.body: a grid of TrackCards sits inside
// Framer Motion's whileHover/whileTap wrappers, which apply an inline
// `transform` during interaction - that creates a new containing block for
// `position: fixed`/absolute descendants, so an anchored dropdown here would
// get trapped inside the hovered card (and can visually overlap sibling
// cards' own hover states). A portal + fixed-position backdrop sidesteps
// both problems entirely.
export default function AddToPlaylistMenu({ track, onChanged }) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newName, setNewName] = useState("");

  function openMenu(e) {
    e.stopPropagation();
    setPlaylists(getPlaylists());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setNewName("");
  }

  function handleToggle(playlistId) {
    if (isTrackInPlaylist(playlistId, track.videoId)) {
      removeTrackFromPlaylist(playlistId, track.videoId);
    } else {
      addTrackToPlaylist(playlistId, track);
    }
    setPlaylists(getPlaylists());
    onChanged?.();
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const playlist = createPlaylist(newName);
    addTrackToPlaylist(playlist.id, track);
    setNewName("");
    setPlaylists(getPlaylists());
    onChanged?.();
  }

  return (
    <>
      <button className="icon-btn" onClick={openMenu} aria-label="Add to playlist" title="Add to playlist">
        +
      </button>
      {open &&
        createPortal(
          <div className="add-to-playlist__backdrop" onClick={close}>
            <div className="add-to-playlist__panel glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="add-to-playlist__header">
                <span className="add-to-playlist__title">Add to playlist</span>
                <button className="add-to-playlist__close" onClick={close} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="add-to-playlist__list">
                {playlists.map((p) => {
                  const inPlaylist = p.tracks.some((t) => t.videoId === track.videoId);
                  return (
                    <button
                      key={p.id}
                      className="add-to-playlist__item"
                      onClick={() => handleToggle(p.id)}
                    >
                      <span>{p.name}</span>
                      {inPlaylist && <span className="add-to-playlist__check">✓</span>}
                    </button>
                  );
                })}
              </div>
              <form className="add-to-playlist__new" onSubmit={handleCreate}>
                <input
                  type="text"
                  placeholder="New playlist name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <button type="submit">Add</button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
