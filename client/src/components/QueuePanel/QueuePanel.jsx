import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { usePlayer } from "../../context/PlayerContext.jsx";
import AlbumArt from "../AlbumArt/AlbumArt.jsx";
import AddToPlaylistMenu from "../AddToPlaylistMenu/AddToPlaylistMenu.jsx";
import "./QueuePanel.css";

function QueueRow({ track, absoluteIndex, onPlay, onRemove }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item value={track} dragListener={false} dragControls={dragControls} className="queue-item">
      <span
        className="queue-item__handle"
        onPointerDown={(e) => dragControls.start(e)}
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
      <button className="queue-item__art" onClick={() => onPlay(absoluteIndex)} aria-label={`Play ${track.title}`}>
        <AlbumArt thumbnail={track.thumbnail} title={track.title} size={40} />
      </button>
      <button className="queue-item__info" onClick={() => onPlay(absoluteIndex)}>
        <div className="queue-item__title">{track.title}</div>
        <div className="queue-item__channel">{track.channelTitle}</div>
      </button>
      <div className="queue-item__actions">
        <AddToPlaylistMenu track={track} />
        <button
          className="icon-btn"
          onClick={() => onRemove(absoluteIndex)}
          aria-label="Remove from queue"
          title="Remove from queue"
        >
          ✕
        </button>
      </div>
    </Reorder.Item>
  );
}

// A Spotify/YouTube-Music-style "Up Next" drawer: shows the currently
// playing track plus everything queued after it, with drag-to-reorder and
// per-track remove/add-to-playlist. Only the upcoming portion is
// reorderable - already-played history (before currentIndex) stays put.
export default function QueuePanel() {
  const {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    autoplay,
    isQueueOpen,
    closeQueue,
    reorderQueue,
    removeFromQueue,
    playFromQueue,
  } = usePlayer();

  const upcoming = queue.slice(currentIndex + 1);

  return (
    <AnimatePresence>
      {isQueueOpen && (
        <>
          <motion.div
            className="queue-panel__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeQueue}
          />
          <motion.div
            className="queue-panel glass-card"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="queue-panel__header">
              <span className="queue-panel__title">Up Next</span>
              <button className="icon-btn" onClick={closeQueue} aria-label="Close queue">
                ✕
              </button>
            </div>

            <div className="queue-panel__scroll">
              {currentTrack && (
                <div className="queue-panel__now-playing">
                  <div className="queue-panel__section-label">Now Playing</div>
                  <div className="queue-item queue-item--current">
                    <AlbumArt
                      thumbnail={currentTrack.thumbnail}
                      title={currentTrack.title}
                      isPlaying={isPlaying}
                      size={40}
                    />
                    <div className="queue-item__info">
                      <div className="queue-item__title">{currentTrack.title}</div>
                      <div className="queue-item__channel">{currentTrack.channelTitle}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="queue-panel__section-label">
                {upcoming.length > 0 ? "Next up" : "Nothing queued next"}
              </div>

              {upcoming.length === 0 ? (
                <p className="empty-state queue-panel__empty">
                  {autoplay
                    ? "Autoplay will add similar songs once this one finishes."
                    : "Turn on autoplay (the ∞ button) to keep similar songs coming, or add tracks from a playlist."}
                </p>
              ) : (
                <Reorder.Group
                  as="div"
                  axis="y"
                  className="queue-panel__list"
                  values={upcoming}
                  onReorder={reorderQueue}
                >
                  {upcoming.map((track, i) => (
                    <QueueRow
                      key={track.videoId}
                      track={track}
                      absoluteIndex={currentIndex + 1 + i}
                      onPlay={playFromQueue}
                      onRemove={removeFromQueue}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
