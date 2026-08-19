import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { describeApiError, fetchArtistInfo, fetchArtistTracks } from "../services/api.js";
import TrackCard from "../components/TrackCard/TrackCard.jsx";

export default function Artist() {
  const { channelId } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [artistStatus, setArtistStatus] = useState("loading");
  const [tracksStatus, setTracksStatus] = useState("loading");
  const [artistError, setArtistError] = useState("");
  const [tracksError, setTracksError] = useState("");

  useEffect(() => {
    setArtist(null);
    setTracks([]);
    setArtistStatus("loading");
    setTracksStatus("loading");

    fetchArtistInfo(channelId)
      .then((info) => {
        setArtist(info);
        setArtistStatus("ready");
      })
      .catch((err) => {
        setArtistError(describeApiError(err, "Couldn't load this artist."));
        setArtistStatus("error");
      });

    fetchArtistTracks(channelId)
      .then((artistTracks) => {
        setTracks(artistTracks);
        setTracksStatus("ready");
      })
      .catch((err) => {
        setTracksError(describeApiError(err, "Couldn't load tracks for this artist right now."));
        setTracksStatus("error");
      });
  }, [channelId]);

  if (artistStatus === "loading") return <p className="status-text">Loading artist...</p>;
  if (artistStatus === "error") return <p className="status-text">{artistError}</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
        {artist?.thumbnail && (
          <img
            src={artist.thumbnail}
            alt={artist.title}
            className="artist-avatar"
            style={{ width: 96, height: 96 }}
          />
        )}
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Artist</div>
          <h1 className="page-heading" style={{ marginBottom: 0 }}>
            {artist?.title || "Artist"}
          </h1>
        </div>
      </div>

      {tracksStatus === "loading" && <p className="status-text">Loading tracks...</p>}
      {tracksStatus === "error" && <p className="empty-state">{tracksError}</p>}
      {tracksStatus === "ready" && tracks.length === 0 && (
        <p className="empty-state">No tracks found for this artist right now.</p>
      )}
      {tracksStatus === "ready" && tracks.length > 0 && (
        <div className="grid">
          {tracks.map((track) => (
            <TrackCard key={track.videoId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  );
}
