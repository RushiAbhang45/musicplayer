import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../../context/PlayerContext.jsx";
import { isLiked, subscribeToPlaylistChanges, toggleLiked } from "../../utils/playlists.js";
import ShareButton from "../ShareButton/ShareButton.jsx";
import "./PlayerBar.css";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    autoplay,
    isFetchingRelated,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleAutoplay,
  } = usePlayer();

  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!currentTrack) {
      setLiked(false);
      return undefined;
    }
    setLiked(isLiked(currentTrack.videoId));
    return subscribeToPlaylistChanges(() => setLiked(isLiked(currentTrack.videoId)));
  }, [currentTrack]);

  function handleToggleLiked() {
    if (!currentTrack) return;
    setLiked(toggleLiked(currentTrack));
  }

  return (
    <div className="player-bar">
      <div className="player-bar__track-info">
        {currentTrack ? (
          <>
            <div className="player-bar__title">{currentTrack.title}</div>
            {currentTrack.channelId ? (
              <Link to={`/artist/${currentTrack.channelId}`} className="player-bar__channel">
                {currentTrack.channelTitle}
              </Link>
            ) : (
              <div className="player-bar__channel">{currentTrack.channelTitle}</div>
            )}
          </>
        ) : (
          <div className="player-bar__idle">Pick a song to start listening</div>
        )}
      </div>

      <div className="player-bar__center">
        <div className="player-bar__controls">
          <button
            className={`icon-btn player-bar__autoplay${autoplay ? " active" : ""}`}
            onClick={toggleAutoplay}
            aria-label={autoplay ? "Autoplay similar songs: on" : "Autoplay similar songs: off"}
            title={autoplay ? "Autoplay similar songs: on" : "Autoplay similar songs: off"}
          >
            ∞
          </button>
          <button onClick={prev} disabled={!currentTrack} aria-label="Previous">
            ⏮
          </button>
          <button
            className="player-bar__play-toggle"
            onClick={togglePlay}
            disabled={!currentTrack}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button onClick={next} disabled={!currentTrack} aria-label="Next">
            ⏭
          </button>
          {currentTrack && (
            <button
              className={`icon-btn player-bar__like${liked ? " active" : ""}`}
              onClick={handleToggleLiked}
              aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
              title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            >
              {liked ? "♥" : "♡"}
            </button>
          )}
          {currentTrack && (
            <ShareButton
              path={`/track/${currentTrack.videoId}`}
              label="Copy link to this track"
              className="player-bar__share"
            />
          )}
        </div>
        <div className="player-bar__progress-row">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!currentTrack}
            aria-label="Seek"
          />
          <span>{formatTime(duration)}</span>
        </div>
        {isFetchingRelated && (
          <div className="player-bar__status">Finding similar songs to play next...</div>
        )}
      </div>

      <div className="player-bar__volume">
        <span aria-hidden="true">🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
