import "./EqualizerBars.css";

// Purely decorative, like AlbumArt's spin/glow - driven by `isPlaying`, not
// real audio data (see AlbumArt.jsx for why: cross-origin YouTube iframe,
// no Web Audio access).
export default function EqualizerBars({ isPlaying = false }) {
  return (
    <div className={`eq-bars${isPlaying ? " is-playing" : ""}`} aria-hidden="true">
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </div>
  );
}
