import { Link } from "react-router-dom";
import { usePlayer } from "../../context/PlayerContext.jsx";
import "./HeroBanner.css";

// Spotlights today's #1 India-trending track. Uses the thumbnail as a
// static background (not a live embed) - PlayerContext already owns two
// hidden YT.Player iframes for crossfade, a third live embed here would
// fight with that.
export default function HeroBanner({ track }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  if (!track) return null;

  const isCurrent = currentTrack?.videoId === track.videoId;

  function handlePlay() {
    // No queue argument on purpose - same convention as the Trending/
    // Recently-Played shelves below: trending is a grab-bag, not a curated
    // playlist, so "Next" should ask /api/related for something similar
    // rather than mechanically walking the chart.
    playTrack(track);
  }

  return (
    <section
      className="hero-banner glass-card"
      style={{ backgroundImage: `url(${track.thumbnail})` }}
    >
      <div className="hero-banner__overlay">
        <div className="hero-banner__eyebrow">#1 Trending in India</div>
        <h1 className="hero-banner__title">{track.title}</h1>
        {track.channelId ? (
          <Link to={`/artist/${track.channelId}`} className="hero-banner__channel">
            {track.channelTitle}
          </Link>
        ) : (
          <div className="hero-banner__channel">{track.channelTitle}</div>
        )}
        <button className="hero-banner__play btn btn-primary" onClick={handlePlay}>
          {isCurrent && isPlaying ? "❚❚ Playing" : "▶ Play"}
        </button>
      </div>
    </section>
  );
}
