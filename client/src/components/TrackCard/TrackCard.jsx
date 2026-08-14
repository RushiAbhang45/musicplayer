import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { usePlayer } from "../../context/PlayerContext.jsx";
import { isLiked, toggleLiked } from "../../utils/playlists.js";
import AddToPlaylistMenu from "../AddToPlaylistMenu/AddToPlaylistMenu.jsx";
import AlbumArt from "../AlbumArt/AlbumArt.jsx";
import "./TrackCard.css";

export default function TrackCard({ track, queue, onRemoveFromPlaylist }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [liked, setLiked] = useState(() => isLiked(track.videoId));

  const isCurrent = currentTrack?.videoId === track.videoId;

  function handlePlay() {
    playTrack(track, queue);
  }

  function handleToggleLiked(e) {
    e.stopPropagation();
    setLiked(toggleLiked(track));
  }

  function handleRemove(e) {
    e.stopPropagation();
    onRemoveFromPlaylist?.(track.videoId);
  }

  return (
    <motion.div
      className="track-card glass-card"
      onClick={handlePlay}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="track-card__art-wrap">
        <AlbumArt thumbnail={track.thumbnail} title={track.title} isPlaying={isCurrent && isPlaying} size="100%" />
        <div className="track-card__play">
          <button className="track-card__play-btn" aria-label={`Play ${track.title}`}>
            {isCurrent && isPlaying ? "❚❚" : "▶"}
          </button>
        </div>
      </div>
      <div className="track-card__body">
        <div className="track-card__info">
          <div className="track-card__title">{track.title}</div>
          <div className="track-card__meta">
            {track.channelId ? (
              <Link
                to={`/artist/${track.channelId}`}
                className="track-card__artist-link"
                onClick={(e) => e.stopPropagation()}
              >
                {track.channelTitle}
              </Link>
            ) : (
              <span>{track.channelTitle}</span>
            )}
            {track.duration && <span>· {track.duration}</span>}
          </div>
        </div>
        <div className="track-card__actions">
          <button
            className={`icon-btn${liked ? " active" : ""}`}
            onClick={handleToggleLiked}
            aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          >
            {liked ? "♥" : "♡"}
          </button>
          <AddToPlaylistMenu track={track} />
          {onRemoveFromPlaylist && (
            <button
              className="icon-btn"
              onClick={handleRemove}
              aria-label="Remove from this playlist"
              title="Remove from this playlist"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
