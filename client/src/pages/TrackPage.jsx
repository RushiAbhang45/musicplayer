import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext.jsx";
import { describeApiError, fetchTrackInfo } from "../services/api.js";
import { isLiked, toggleLiked } from "../utils/playlists.js";
import AlbumArt from "../components/AlbumArt/AlbumArt.jsx";
import AddToPlaylistMenu from "../components/AddToPlaylistMenu/AddToPlaylistMenu.jsx";
import ShareButton from "../components/ShareButton/ShareButton.jsx";

export default function TrackPage() {
  const { videoId } = useParams();
  const { playTrack, currentTrack, isPlaying, isReady } = usePlayer();
  const [track, setTrack] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [liked, setLiked] = useState(false);
  const autoplayedRef = useRef(false);

  useEffect(() => {
    autoplayedRef.current = false;
    setStatus("loading");
    fetchTrackInfo(videoId)
      .then((data) => {
        setTrack(data);
        setLiked(isLiked(data.videoId));
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMessage(describeApiError(err, "Couldn't load this track."));
        setStatus("error");
      });
  }, [videoId]);

  // Auto-play once both the track info has loaded and the YouTube player is
  // ready - whichever finishes last (the player's own async init can easily
  // outrace our fetch on a cold page load). Browsers may still block
  // audible autoplay without a prior gesture on the page, hence the
  // always-visible Play button below as a guaranteed fallback.
  useEffect(() => {
    if (track && isReady && !autoplayedRef.current) {
      autoplayedRef.current = true;
      playTrack(track);
    }
  }, [track, isReady, playTrack]);

  if (status === "loading") return <p className="status-text">Loading track...</p>;
  if (status === "error") return <p className="status-text">{errorMessage}</p>;

  const isCurrent = currentTrack?.videoId === track.videoId;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <AlbumArt
          thumbnail={track.thumbnail}
          title={track.title}
          isPlaying={isCurrent && isPlaying}
          size={220}
        />
        <div style={{ textAlign: "center" }}>
          <h1 className="page-heading" style={{ fontSize: 22, marginBottom: 6 }}>
            {track.title}
          </h1>
          {track.channelId ? (
            <Link to={`/artist/${track.channelId}`} style={{ color: "var(--text-muted)" }}>
              {track.channelTitle}
            </Link>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>{track.channelTitle}</span>
          )}
          {track.duration && <span style={{ color: "var(--text-dim)" }}> · {track.duration}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-primary" onClick={() => playTrack(track)}>
            {isCurrent && isPlaying ? "❚❚ Playing" : "▶ Play"}
          </button>
          <button
            className={`icon-btn${liked ? " active" : ""}`}
            onClick={() => setLiked(toggleLiked(track))}
            aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          >
            {liked ? "♥" : "♡"}
          </button>
          <AddToPlaylistMenu track={track} />
          <ShareButton path={`/track/${track.videoId}`} label="Copy link to this track" />
        </div>

        {!(isCurrent && isPlaying) && (
          <p className="status-text" style={{ marginTop: 0 }}>
            Tap Play if it doesn't start automatically.
          </p>
        )}
      </div>
    </div>
  );
}
