import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, login as loginApi, logout as logoutApi, signup as signupApi } from "../services/api.js";
import {
  hasBeenPromptedForImport,
  hasImportableLocalData,
  markImportPrompted,
  setPlaylistsAuthState,
} from "../utils/playlists.js";
import { setPlayerStateAuthState } from "../utils/playerState.js";

const AuthContext = createContext(null);

// Deliberately separate from PlayerContext (no cross-imports either way) -
// recently-played server sync (see PlayerContext.playTrack) just attempts a
// request and ignores 401/503, so it never needs to know auth state. The
// player-state sync is the one exception: it reads a module-level flag in
// utils/playerState.js (set here) instead of a direct import, so it can
// back off after the first 401 rather than retrying every few seconds -
// see that file's comment for why.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready"
  const [accountsEnabled, setAccountsEnabled] = useState(true);
  const [pendingImport, setPendingImport] = useState(false);

  useEffect(() => {
    fetchMe()
      .then(({ user: me }) => {
        setUser(me);
        setPlaylistsAuthState(me.id);
        setPlayerStateAuthState(me.id);
      })
      .catch((err) => {
        if (err?.response?.status === 503) setAccountsEnabled(false);
        setUser(null);
        setPlaylistsAuthState(null);
      })
      .finally(() => setStatus("ready"));
  }, []);

  function checkPendingImport() {
    if (hasImportableLocalData() && !hasBeenPromptedForImport()) {
      setPendingImport(true);
    }
  }

  const signup = useCallback(async (email, password) => {
    const { user: created } = await signupApi(email, password);
    setUser(created);
    setPlaylistsAuthState(created.id);
    setPlayerStateAuthState(created.id);
    checkPendingImport();
    return created;
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: loggedIn } = await loginApi(email, password);
    setUser(loggedIn);
    setPlaylistsAuthState(loggedIn.id);
    setPlayerStateAuthState(loggedIn.id);
    checkPendingImport();
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setPlaylistsAuthState(null);
  }, []);

  const dismissImportPrompt = useCallback(() => {
    markImportPrompted();
    setPendingImport(false);
  }, []);

  const value = {
    user,
    status,
    accountsEnabled,
    pendingImport,
    dismissImportPrompt,
    signup,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
