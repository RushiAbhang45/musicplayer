import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SearchBar from "../SearchBar/SearchBar.jsx";
import "./Header.css";

export default function Header() {
  const { user, accountsEnabled, logout } = useAuth();

  return (
    <header className="site-header">
      <NavLink to="/" className="site-header__logo gradient-text">
        MusicPlayer
      </NavLink>
      <nav className="site-header__nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Home
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => (isActive ? "active" : "")}>
          Library
        </NavLink>
      </nav>
      <div className="site-header__search">
        <SearchBar />
      </div>
      {accountsEnabled && (
        <div className="site-header__account">
          {user ? (
            <>
              <span className="site-header__email">{user.email}</span>
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
