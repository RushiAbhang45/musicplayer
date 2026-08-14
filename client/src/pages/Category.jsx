import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { describeApiError, fetchCategories, fetchCategoryTracks } from "../services/api.js";
import TrackCard from "../components/TrackCard/TrackCard.jsx";
import ShareButton from "../components/ShareButton/ShareButton.jsx";

export default function Category() {
  const { id } = useParams();
  const [category, setCategory] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setStatus("loading");
    Promise.all([fetchCategories(), fetchCategoryTracks(id)])
      .then(([categories, categoryTracks]) => {
        setCategory(categories.find((c) => c.id === id) || null);
        setTracks(categoryTracks);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMessage(describeApiError(err, "Couldn't load this playlist."));
        setStatus("error");
      });
  }, [id]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 className="page-heading" style={{ marginBottom: 0 }}>
          {category ? (
            <>
              <span aria-hidden="true">{category.icon}</span> {category.name}
            </>
          ) : (
            "Playlist"
          )}
        </h1>
        <ShareButton path={`/category/${id}`} label="Copy link to this playlist" />
      </div>

      {status === "loading" && <p className="status-text">Loading tracks...</p>}
      {status === "error" && <p className="status-text">{errorMessage}</p>}
      {status === "ready" && tracks.length === 0 && (
        <p className="empty-state">No tracks found for this playlist right now.</p>
      )}
      {status === "ready" && tracks.length > 0 && (
        <div className="grid">
          {tracks.map((track) => (
            <TrackCard key={track.videoId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  );
}
