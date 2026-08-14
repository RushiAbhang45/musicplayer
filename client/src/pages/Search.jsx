import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { describeApiError, searchTracks } from "../services/api.js";
import TrackCard from "../components/TrackCard/TrackCard.jsx";

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [tracks, setTracks] = useState([]);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!q) {
      setTracks([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    searchTracks(q)
      .then((data) => {
        setTracks(data);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMessage(describeApiError(err, "Search failed. Try again in a moment."));
        setStatus("error");
      });
  }, [q]);

  return (
    <div>
      <h1 className="page-heading">{q ? `Results for "${q}"` : "Search"}</h1>

      {status === "idle" && <p className="status-text">Type a song, artist, or vibe to search.</p>}
      {status === "loading" && <p className="status-text">Searching YouTube...</p>}
      {status === "error" && <p className="status-text">{errorMessage}</p>}
      {status === "ready" && tracks.length === 0 && (
        <p className="empty-state">No results for "{q}".</p>
      )}
      {status === "ready" && tracks.length > 0 && (
        <div className="grid">
          {tracks.map((track) => (
            // No `queue` here on purpose: search results for one song are
            // mostly just other versions of that same song (slowed, lofi,
            // lyric video...), so "Next" should jump straight to genuinely
            // similar songs (the related-songs radio) instead of cycling
            // through those near-duplicates.
            <TrackCard key={track.videoId} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
