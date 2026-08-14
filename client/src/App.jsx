import { Route, Routes } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext.jsx";
import Header from "./components/Header/Header.jsx";
import PlayerBar from "./components/PlayerBar/PlayerBar.jsx";
import Home from "./pages/Home.jsx";
import Category from "./pages/Category.jsx";
import Search from "./pages/Search.jsx";
import Playlists from "./pages/Playlists.jsx";
import PlaylistDetail from "./pages/PlaylistDetail.jsx";
import Artist from "./pages/Artist.jsx";

export default function App() {
  return (
    <PlayerProvider>
      <div className="app-shell">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/category/:id" element={<Category />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Playlists />} />
            <Route path="/playlist/:id" element={<PlaylistDetail />} />
            <Route path="/artist/:channelId" element={<Artist />} />
          </Routes>
        </main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
