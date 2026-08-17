import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PlayerProvider } from "./context/PlayerContext.jsx";
import Header from "./components/Header/Header.jsx";
import PlayerBar from "./components/PlayerBar/PlayerBar.jsx";
import PageTransition from "./components/PageTransition/PageTransition.jsx";
import ImportPlaylistsPrompt from "./components/ImportPlaylistsPrompt/ImportPlaylistsPrompt.jsx";
import Home from "./pages/Home.jsx";
import Category from "./pages/Category.jsx";
import Search from "./pages/Search.jsx";
import Playlists from "./pages/Playlists.jsx";
import PlaylistDetail from "./pages/PlaylistDetail.jsx";
import Artist from "./pages/Artist.jsx";
import TrackPage from "./pages/TrackPage.jsx";
import Login from "./pages/Auth/Login.jsx";
import Signup from "./pages/Auth/Signup.jsx";

export default function App() {
  const location = useLocation();

  return (
    <AuthProvider>
      <PlayerProvider>
        <div className="app-shell">
          <Header />
          <main className="app-main">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageTransition><Home /></PageTransition>} />
                <Route path="/category/:id" element={<PageTransition><Category /></PageTransition>} />
                <Route path="/search" element={<PageTransition><Search /></PageTransition>} />
                <Route path="/library" element={<PageTransition><Playlists /></PageTransition>} />
                <Route path="/playlist/:id" element={<PageTransition><PlaylistDetail /></PageTransition>} />
                <Route path="/artist/:channelId" element={<PageTransition><Artist /></PageTransition>} />
                <Route path="/track/:videoId" element={<PageTransition><TrackPage /></PageTransition>} />
                <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
                <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
              </Routes>
            </AnimatePresence>
          </main>
          <PlayerBar />
          <ImportPlaylistsPrompt />
        </div>
      </PlayerProvider>
    </AuthProvider>
  );
}
