import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import "./PlaylistCard.css";

export default function PlaylistCard({ playlist }) {
  const covers = playlist.tracks.slice(0, 4);

  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
      <Link to={`/playlist/${playlist.id}`}>
        <div className="playlist-card glass-card">
          <div
            className={`playlist-card__art${covers.length === 1 ? " playlist-card__art--single" : ""}`}
          >
            {covers.length === 0 ? (
              <div className="playlist-card__art--empty">
                {playlist.id === "liked" ? "♥" : "🎵"}
              </div>
            ) : (
              covers.map((t) => <img key={t.videoId} src={t.thumbnail} alt="" loading="lazy" />)
            )}
          </div>
          <div className="playlist-card__name">{playlist.name}</div>
          <div className="playlist-card__count">
            {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
