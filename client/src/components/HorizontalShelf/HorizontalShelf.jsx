import { useRef } from "react";
import { Link } from "react-router-dom";
import "./HorizontalShelf.css";

const SCROLL_AMOUNT = 640;

// Generic scrollable "shelf" row - the shared shell behind the Trending,
// Recently Played, and (via ArtistAvatarRow) Popular Artists sections on
// Home. Agnostic to what's inside: pass TrackCards, avatar links, whatever.
export default function HorizontalShelf({ title, viewAllHref, children }) {
  const scrollRef = useRef(null);

  function scrollBy(amount) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <section className="shelf">
      <div className="shelf__header">
        <h2 className="shelf__title">{title}</h2>
        <div className="shelf__header-actions">
          {viewAllHref && (
            <Link to={viewAllHref} className="shelf__view-all">
              View all
            </Link>
          )}
          <button
            className="icon-btn shelf__arrow"
            onClick={() => scrollBy(-SCROLL_AMOUNT)}
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            className="icon-btn shelf__arrow"
            onClick={() => scrollBy(SCROLL_AMOUNT)}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>
      <div className="shelf__scroll" ref={scrollRef}>
        {children}
      </div>
    </section>
  );
}
