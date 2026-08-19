import { useEffect, useState } from "react";
import { fetchPopularArtists, fetchServerRecentPlays, fetchTrending } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getRecentlyPlayed } from "../utils/recentlyPlayed.js";
import HeroBanner from "../components/HeroBanner/HeroBanner.jsx";
import HorizontalShelf from "../components/HorizontalShelf/HorizontalShelf.jsx";
import ArtistAvatarRow from "../components/ArtistAvatarRow/ArtistAvatarRow.jsx";
import TrackCard from "../components/TrackCard/TrackCard.jsx";

export default function Home() {
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [trendingStatus, setTrendingStatus] = useState("loading");
  const [recent, setRecent] = useState([]);
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    fetchTrending()
      .then((data) => {
        setTrending(data);
        setTrendingStatus("ready");
      })
      .catch(() => setTrendingStatus("error"));

    fetchPopularArtists()
      .then(setArtists)
      .catch(() => setArtists([]));
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

  const [heroTrack, ...restTrending] = trending;

  return (
    <div>
      {trendingStatus === "loading" && <p className="status-text">Loading...</p>}
      {trendingStatus === "error" && (
        <p className="status-text">
          Couldn't load music. Make sure the server is running and YOUTUBE_API_KEY is set.
        </p>
      )}

      {heroTrack && <HeroBanner track={heroTrack} />}

      {restTrending.length > 0 && (
        // No `queue` on the TrackCards below on purpose (see Search.jsx for
        // the same pattern): trending is a grab-bag across every genre/mood,
        // not a curated playlist, so cycling through it mechanically on
        // "Next" would jump from a Bollywood song to a national anthem to a
        // movie trailer. "Next" should jump straight to the related-songs
        // radio for genuinely similar tracks instead.
        <HorizontalShelf title="Trending in India">
          {restTrending.map((track) => (
            <div className="shelf__item" key={track.videoId}>
              <TrackCard track={track} />
            </div>
          ))}
        </HorizontalShelf>
      )}

      {recent.length > 0 && (
        <HorizontalShelf title="Recently Played">
          {recent.map((track) => (
            // Same reasoning as trending above - recently played spans
            // whatever moods you were in on past visits, not a single
            // coherent listening session to walk through in order.
            <div className="shelf__item" key={track.videoId}>
              <TrackCard track={track} />
            </div>
          ))}
        </HorizontalShelf>
      )}

      <ArtistAvatarRow artists={artists} />
    </div>
  );
}
