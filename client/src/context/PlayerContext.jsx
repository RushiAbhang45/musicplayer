import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { fetchRelatedTracks, recordServerPlay } from "../services/api.js";
import { recordPlay } from "../utils/recentlyPlayed.js";

const PlayerContext = createContext(null);
const YT_PLAYER_CONTAINER_ID = "yt-player-mount";

// Mounted once, above the router, so the single YT.Player instance is never
// torn down on navigation - that's what makes playback survive page changes.
export function PlayerProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [autoplay, setAutoplay] = useState(true);
  const [isFetchingRelated, setIsFetchingRelated] = useState(false);

  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  const autoplayRef = useRef(autoplay);
  const wakeLockRef = useRef(null);
  queueRef.current = queue;
  indexRef.current = currentIndex;
  autoplayRef.current = autoplay;

  const loadAt = useCallback((list, index) => {
    const track = list[index];
    const player = playerRef.current;
    if (!track || !player) return;
    setQueue(list);
    setCurrentIndex(index);
    setCurrentTime(0);
    player.loadVideoById(track.videoId);
  }, []);

  const goNext = useCallback(async () => {
    const list = queueRef.current;
    const idx = indexRef.current;

    if (idx + 1 < list.length) {
      loadAt(list, idx + 1);
      return;
    }

    if (!autoplayRef.current) return;
    const current = list[idx];
    if (!current) return;

    setIsFetchingRelated(true);
    try {
      const related = await fetchRelatedTracks(current.videoId, {
        categoryId: current.categoryId,
        excludeIds: list.map((t) => t.videoId),
      });
      const existingIds = new Set(list.map((t) => t.videoId));
      const fresh = related.filter((t) => !existingIds.has(t.videoId));
      if (fresh.length === 0) return;
      loadAt([...list, ...fresh], idx + 1);
    } catch {
      // no related tracks available - just stop, nothing more to play
    } finally {
      setIsFetchingRelated(false);
    }
  }, [loadAt]);

  const goPrev = useCallback(() => {
    const list = queueRef.current;
    const idx = indexRef.current;
    if (idx > 0) loadAt(list, idx - 1);
  }, [loadAt]);

  const handleStateChange = useCallback(
    (event) => {
      const YT = window.YT;
      if (!YT) return;
      if (event.data === YT.PlayerState.PLAYING) {
        setIsPlaying(true);
        setDuration(event.target.getDuration() || 0);
      } else if (event.data === YT.PlayerState.PAUSED) {
        setIsPlaying(false);
      } else if (event.data === YT.PlayerState.ENDED) {
        setIsPlaying(false);
        goNext();
      }
    },
    [goNext]
  );

  const { playerRef, isReady } = useYouTubePlayer(YT_PLAYER_CONTAINER_ID, {
    onStateChange: handleStateChange,
  });

  useEffect(() => {
    if (isReady) playerRef.current?.setVolume(volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (player?.getCurrentTime) setCurrentTime(player.getCurrentTime());
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, playerRef]);

  const playTrack = useCallback(
    (track, list) => {
      const player = playerRef.current;
      if (!player) return;
      const effectiveList = list && list.length ? list : [track];
      const index = effectiveList.findIndex((t) => t.videoId === track.videoId);
      loadAt(effectiveList, index === -1 ? 0 : index);
      player.playVideo();
      setIsPlaying(true);
      recordPlay(track);
      // Fire-and-forget: a 401 (guest) or 503 (accounts disabled on this
      // deployment) is expected and silently ignored. PlayerContext never
      // imports AuthContext - this keeps the two decoupled instead of
      // depending on provider ordering.
      recordServerPlay(track).catch(() => {});
    },
    [loadAt, playerRef]
  );

  const playFromQueue = useCallback(
    (absoluteIndex) => {
      const player = playerRef.current;
      if (!player) return;
      loadAt(queueRef.current, absoluteIndex);
      player.playVideo();
      setIsPlaying(true);
    },
    [loadAt, playerRef]
  );

  // Only the "up next" portion (after the currently-playing track) can be
  // reordered/removed - already-played history stays put, matching the
  // Spotify/YouTube Music convention this is modeled on.
  const reorderQueue = useCallback((newUpcoming) => {
    setQueue((prev) => {
      const head = prev.slice(0, indexRef.current + 1);
      return [...head, ...newUpcoming];
    });
  }, []);

  const removeFromQueue = useCallback((absoluteIndex) => {
    setQueue((prev) => (absoluteIndex <= indexRef.current ? prev : prev.filter((_, i) => i !== absoluteIndex)));
  }, []);

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const toggleQueue = useCallback(() => setIsQueueOpen((v) => !v), []);
  const closeQueue = useCallback(() => setIsQueueOpen(false), []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [playerRef, isPlaying]);

  const seek = useCallback(
    (seconds) => {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    },
    [playerRef]
  );

  const seekRef = useRef(seek);
  seekRef.current = seek;

  const changeVolume = useCallback(
    (value) => {
      setVolume(value);
      playerRef.current?.setVolume(value);
    },
    [playerRef]
  );

  const toggleAutoplay = useCallback(() => setAutoplay((v) => !v), []);

  // Media Session API: shows track info + play/pause/skip controls on the
  // lock screen / notification shade. Registered once (handlers reach the
  // player directly via refs rather than depending on changing state), so
  // this doesn't churn on every play/pause. How reliably the OS actually
  // keeps audio alive in the background still depends on the platform -
  // see README for the YouTube-iframe caveat, this is best-effort.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;

    navigator.mediaSession.setActionHandler("play", () => playerRef.current?.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => playerRef.current?.pauseVideo());
    navigator.mediaSession.setActionHandler("previoustrack", () => goPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => goNext());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) seekRef.current(details.seekTime);
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [playerRef, goPrev, goNext]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Screen Wake Lock: keeps the screen from auto-locking (idle timeout)
  // while music is playing, since YouTube's iframe player gets suspended
  // the moment the screen actually locks - see README for why we can't
  // reliably survive an *intentional* lock (power button) without ripping
  // audio out of YouTube's player, which we won't do. This only covers the
  // far more common "walked away and the phone timed out" case. Doesn't
  // block the physical lock button; not supported on every browser.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return undefined;
    let cancelled = false;

    async function acquireWakeLock() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        // refused (e.g. low battery mode, no user gesture yet) - fine
      }
    }

    function handleVisibilityChange() {
      if (isPlaying && document.visibilityState === "visible" && !wakeLockRef.current) {
        acquireWakeLock();
      }
    }

    if (isPlaying) acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isPlaying]);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.channelTitle,
      artwork: currentTrack.thumbnail
        ? [{ src: currentTrack.thumbnail, sizes: "480x360", type: "image/jpeg" }]
        : [],
    });
  }, [currentTrack]);

  const value = {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    isReady,
    currentTime,
    duration,
    volume,
    autoplay,
    isFetchingRelated,
    playTrack,
    togglePlay,
    next: goNext,
    prev: goPrev,
    seek,
    setVolume: changeVolume,
    toggleAutoplay,
    isQueueOpen,
    toggleQueue,
    closeQueue,
    reorderQueue,
    removeFromQueue,
    playFromQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <div className="yt-player-mount" aria-hidden="true">
        <div id={YT_PLAYER_CONTAINER_ID} />
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
