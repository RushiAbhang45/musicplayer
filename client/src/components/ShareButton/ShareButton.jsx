import { useState } from "react";
import "./ShareButton.css";

// Copies an absolute shareable link (origin + path) to the clipboard.
// `path` is a router path like `/track/abc123`, `/category/party`, or
// `/playlist/p_123` - the caller decides what's being shared.
export default function ShareButton({ path, label = "Copy share link", className = "" }) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    // Fallback for contexts without Clipboard API access (e.g. plain-http
    // LAN IPs, which browsers don't treat as a secure origin).
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function handleClick(e) {
    e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    try {
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied - nothing more we can do silently.
    }
  }

  return (
    <button
      className={`share-btn icon-btn ${className}`.trim()}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {copied && <span className="share-btn__tooltip">Copied!</span>}
      <span aria-hidden="true">{copied ? "✓" : "🔗"}</span>
    </button>
  );
}
