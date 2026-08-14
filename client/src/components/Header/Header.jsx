import { NavLink } from "react-router-dom";
import SearchBar from "../SearchBar/SearchBar.jsx";
import "./Header.css";

export default function Header() {
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
    </header>
  );
}
