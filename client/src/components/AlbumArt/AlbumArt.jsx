import "./AlbumArt.css";

// Purely decorative artwork - the real audio plays inside a cross-origin
// YouTube iframe, so there's no Web Audio access for a true audio-reactive
// visualizer. This just pulses/glows in sync with `isPlaying`.
export default function AlbumArt({ thumbnail, title, isPlaying = false, size = 48 }) {
  return (
    <div className={`album-art${isPlaying ? " is-playing" : ""}`} style={{ width: size, height: size }}>
      <div className="album-art__ring" />
      <div className="album-art__frame">
        {thumbnail ? (
          <img src={thumbnail} alt={title || ""} loading="lazy" />
        ) : (
          <div aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
