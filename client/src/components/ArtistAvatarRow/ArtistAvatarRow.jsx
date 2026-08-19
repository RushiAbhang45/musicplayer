import { Link } from "react-router-dom";
import HorizontalShelf from "../HorizontalShelf/HorizontalShelf.jsx";
import "./ArtistAvatarRow.css";

export default function ArtistAvatarRow({ artists }) {
  if (!artists || artists.length === 0) return null;

  return (
    <HorizontalShelf title="Popular Artists">
      {artists.map((artist) => (
        <Link
          key={artist.channelId}
          to={`/artist/${artist.channelId}`}
          className="shelf__item shelf__item--avatar artist-avatar-row__item"
        >
          <img src={artist.thumbnail} alt={artist.title} className="artist-avatar" />
          <span className="artist-avatar-row__name">{artist.title}</span>
        </Link>
      ))}
    </HorizontalShelf>
  );
}
