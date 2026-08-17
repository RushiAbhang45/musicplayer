import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayer } from "../../context/PlayerContext.jsx";
import { isLiked, subscribeToPlaylistChanges, toggleLiked } from "../../utils/playlists.js";
import AlbumArt from "../AlbumArt/AlbumArt.jsx";
import EqualizerBars from "../EqualizerBars/EqualizerBars.jsx";
import ShareButton from "../ShareButton/ShareButton.jsx";
import QueuePanel from "../QueuePanel/QueuePanel.jsx";
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
    queue,
    currentIndex,
    isQueueOpen,
    toggleQueue,
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
    <div className={`player-bar${isPlaying ? " is-playing" : ""}`}>
      <div className="player-bar__track-info">
        {currentTrack ? (
          <>
            <AlbumArt
              thumbnail={currentTrack.thumbnail}
              title={currentTrack.title}
              isPlaying={isPlaying}
              size={48}
            />
            <div className="player-bar__track-text">
              <div className="player-bar__title-row">
                <div className="player-bar__title">{currentTrack.title}</div>
                <EqualizerBars isPlaying={isPlaying} />
              </div>
              {currentTrack.channelId ? (
                <Link to={`/artist/${currentTrack.channelId}`} className="player-bar__channel">
                  {currentTrack.channelTitle}
                </Link>
              ) : (
                <div className="player-bar__channel">{currentTrack.channelTitle}</div>
              )}
            </div>
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
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isPlaying ? "pause" : "play"}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isPlaying ? "❚❚" : "▶"}
              </motion.span>
            </AnimatePresence>
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

      <button
        className={`icon-btn player-bar__queue-toggle${isQueueOpen ? " active" : ""}`}
        onClick={toggleQueue}
        aria-label="Up next queue"
        title="Up next queue"
      >
        ☰
        {queue.length - currentIndex - 1 > 0 && (
          <span className="player-bar__queue-count">{queue.length - currentIndex - 1}</span>
        )}
      </button>

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

      <QueuePanel />
    </div>
  );
}
