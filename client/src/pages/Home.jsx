import { useEffect, useState } from "react";
import { fetchCategories, fetchServerRecentPlays, fetchTrending } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getRecentlyPlayed } from "../utils/recentlyPlayed.js";
import CategoryGrid from "../components/CategoryGrid/CategoryGrid.jsx";
import TrackCard from "../components/TrackCard/TrackCard.jsx";

export default function Home() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetchCategories()
      .then((data) => {
        setCategories(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    fetchTrending()
      .then(setTrending)
      .catch(() => setTrending([]));
  }, []);

  useEffect(() => {
    // A server-fetch error (not just "empty") falls back to the local list
    // rather than showing an error - this is a homepage decoration section,
    // it should never block the page.
    if (user) {
      fetchServerRecentPlays()
        .then(setRecent)
        .catch(() => setRecent(getRecentlyPlayed()));
    } else {
      setRecent(getRecentlyPlayed());
    }
  }, [user]);

  return (
    <div>
      <section style={{ marginBottom: 36 }}>
        <h1 className="page-heading gradient-text">Every hit, one place.</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
          Sufi &amp; romance, party anthems, throwback decades, and whatever else you can find on
          YouTube — pick a playlist or search for anything.
        </p>
      </section>

      {trending.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 className="page-heading" style={{ fontSize: 20, marginBottom: 14 }}>
            Trending in India
          </h2>
          <div className="grid">
            {trending.map((track) => (
              // No `queue` here on purpose (see Search.jsx for the same
              // pattern): trending is a grab-bag across every genre/mood,
              // not a curated playlist, so cycling through it mechanically
              // on "Next" would jump from a Bollywood song to a national
              // anthem to a movie trailer. "Next" should jump straight to
              // the related-songs radio for genuinely similar tracks instead.
              <TrackCard key={track.videoId} track={track} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 className="page-heading" style={{ fontSize: 20, marginBottom: 14 }}>
            Recently Played
          </h2>
          <div className="grid">
            {recent.map((track) => (
              // Same reasoning as trending above - recently played spans
              // whatever moods you were in on past visits, not a single
              // coherent listening session to walk through in order.
              <TrackCard key={track.videoId} track={track} />
            ))}
          </div>
        </section>
      )}

      {status === "loading" && <p className="status-text">Loading playlists...</p>}
      {status === "error" && (
        <p className="status-text">
          Couldn't load playlists. Make sure the server is running and YOUTUBE_API_KEY is set.
        </p>
      )}
      {status === "ready" && <CategoryGrid categories={categories} />}
    </div>
  );
}
