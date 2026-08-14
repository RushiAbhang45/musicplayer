import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePlayer } from "../../context/PlayerContext.jsx";
import { describeApiError, searchTracks } from "../../services/api.js";
import { addRecentSearch, getRecentSearches, removeRecentSearch } from "../../utils/recentSearches.js";
import "./SearchBar.css";

const SUGGESTION_LIMIT = 6;
const DEBOUNCE_MS = 350;

export default function SearchBar() {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const [params] = useSearchParams();
  const [value, setValue] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [suggestionError, setSuggestionError] = useState("");

  const rootRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const showingRecents = value.trim().length === 0;
  const list = showingRecents ? recents : suggestions;

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlighted(-1);
    clearTimeout(debounceRef.current);

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSuggestionError("");
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchTracks(query, SUGGESTION_LIMIT);
        if (requestId === requestIdRef.current) setSuggestions(results);
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setSuggestions([]);
          setSuggestionError(describeApiError(err, "No matches yet"));
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  function handleFocus() {
    setRecents(getRecentSearches());
    setOpen(true);
  }

  function runSearch(query) {
    const q = query.trim();
    if (!q) return;
    addRecentSearch(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(value);
  }

  function handlePlaySuggestion(track) {
    addRecentSearch(value);
    // No queue here on purpose - see Search.jsx for why (near-duplicate
    // results shouldn't be what "Next" cycles through).
    playTrack(track);
    setOpen(false);
  }

  function handleRecentClick(query) {
    setValue(query);
    runSearch(query);
  }

  function handleRemoveRecent(e, query) {
    e.stopPropagation();
    removeRecentSearch(query);
    setRecents(getRecentSearches());
  }

  function handleKeyDown(e) {
    if (!open || list.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      const item = list[highlighted];
      showingRecents ? handleRecentClick(item) : handlePlaySuggestion(item);
    }
  }

  return (
    <div className="search-bar-wrap" ref={rootRef}>
      <form className="search-bar" onSubmit={handleSubmit} role="search">
        <span className="search-bar__icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          placeholder="Search any song on YouTube..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-label="Search songs"
          autoComplete="off"
        />
      </form>

      {open && (showingRecents ? recents.length > 0 : true) && (
        <div className="search-suggestions glass-card">
          {showingRecents && (
            <div className="search-suggestions__title">Recent searches</div>
          )}
          {!showingRecents && loading && (
            <div className="search-suggestions__status">Searching...</div>
          )}
          {!showingRecents && !loading && suggestions.length === 0 && (
            <div className="search-suggestions__status">{suggestionError || "No matches yet"}</div>
          )}

          {showingRecents
            ? recents.map((q, i) => (
                <button
                  key={q}
                  className={`search-suggestions__item search-suggestions__item--recent${
                    i === highlighted ? " highlighted" : ""
                  }`}
                  onClick={() => handleRecentClick(q)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span className="search-suggestions__recent-icon" aria-hidden="true">
                    ⟲
                  </span>
                  <span className="search-suggestions__recent-text">{q}</span>
                  <span
                    className="search-suggestions__remove"
                    onClick={(e) => handleRemoveRecent(e, q)}
                    role="button"
                    aria-label={`Remove "${q}" from recent searches`}
                  >
                    ✕
                  </span>
                </button>
              ))
            : suggestions.map((track, i) => (
                <button
                  key={track.videoId}
                  className={`search-suggestions__item${i === highlighted ? " highlighted" : ""}`}
                  onClick={() => handlePlaySuggestion(track)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <img src={track.thumbnail} alt="" className="search-suggestions__thumb" />
                  <span className="search-suggestions__text">
                    <span className="search-suggestions__track-title">{track.title}</span>
                    <span className="search-suggestions__track-channel">{track.channelTitle}</span>
                  </span>
                  <span className="search-suggestions__play" aria-hidden="true">
                    ▶
                  </span>
                </button>
              ))}

          {!showingRecents && suggestions.length > 0 && (
            <button
              className="search-suggestions__see-all"
              onClick={() => runSearch(value)}
              onMouseEnter={() => setHighlighted(-1)}
            >
              See all results for "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
