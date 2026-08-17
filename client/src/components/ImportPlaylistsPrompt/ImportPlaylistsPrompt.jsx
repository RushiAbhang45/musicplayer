import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { importLocalPlaylistsToAccount } from "../../utils/playlists.js";
import "./ImportPlaylistsPrompt.css";

// Shown once after first login/signup if the browser has guest-mode
// playlists worth keeping. Local data is never deleted automatically -
// declining just leaves it in place as an orphaned backup.
export default function ImportPlaylistsPrompt() {
  const { pendingImport, dismissImportPrompt } = useAuth();
  const [importing, setImporting] = useState(false);

  if (!pendingImport) return null;

  async function handleImport() {
    setImporting(true);
    try {
      await importLocalPlaylistsToAccount();
    } catch {
      // fine to leave local data in place and let them try again later
    } finally {
      setImporting(false);
      dismissImportPrompt();
    }
  }

  return createPortal(
    <div className="import-prompt__backdrop">
      <div className="import-prompt__panel glass-card">
        <h2 className="import-prompt__title">Import your local playlists?</h2>
        <p className="import-prompt__body">
          This browser has playlists saved locally. Bring them into your account so they follow you
          across devices?
        </p>
        <div className="import-prompt__actions">
          <button className="btn" onClick={dismissImportPrompt} disabled={importing}>
            Not now
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
