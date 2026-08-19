import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SearchBar from "../SearchBar/SearchBar.jsx";
import "./TopBar.css";

export default function TopBar({ onOpenDrawer }) {
  const { user, accountsEnabled, logout } = useAuth();

  return (
    <header className="topbar">
      <button
        className="topbar__hamburger icon-btn"
        onClick={onOpenDrawer}
        aria-label="Open menu"
        title="Menu"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      <NavLink to="/" className="topbar__logo gradient-text">
        MusicPlayer
      </NavLink>

      <div className="topbar__search-full">
        <SearchBar />
      </div>
      <Link to="/search" className="topbar__search-icon icon-btn" aria-label="Search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </Link>

      {accountsEnabled && (
        <div className="topbar__account">
          {user ? (
            <>
              <span className="topbar__email">{user.email}</span>
              <button className="btn" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary">
              Log in
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
