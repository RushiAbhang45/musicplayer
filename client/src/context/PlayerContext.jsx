import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { fetchRelatedTracks, fetchServerPlayerState, recordServerPlay, saveServerPlayerState } from "../services/api.js";
import { recordPlay } from "../utils/recentlyPlayed.js";
import { getSavedPlayerState, savePlayerState } from "../utils/playerState.js";

// How often playback position gets persisted while playing - frequent enough
// that a crash/close doesn't lose much progress, infrequent enough not to
// hammer localStorage/the DB on every 500ms UI tick.
const PERSIST_INTERVAL_MS = 5000;

// Crossfade tuning. Two hidden players take turns being "active" (audible)
// vs "standby" (silently preloading the next track) - see beginTransition
// below for the handoff mechanics. Auto (natural end-of-track) gets a full
// musical crossfade; manual actions (Next/Previous/queue-jump) get a quick
// fade instead of an instant cut, so nothing ever hard-clicks.
const CROSSFADE_TRIGGER_SECONDS = 5;
const CROSSFADE_DURATION_AUTO_MS = 4000;
const CROSSFADE_DURATION_MANUAL_MS = 1000;
const CROSSFADE_TICK_MS = 50;
// Proactively refetch related tracks well before the crossfade trigger, so
// a next track already exists in the queue by the time it's needed instead
// of racing a network call against the fade window.
const REFILL_TRIGGER_SECONDS = 20;

const PlayerContext = createContext(null);
const PLAYER_CONTAINER_IDS = ["yt-player-mount-a", "yt-player-mount-b"];

// Mounted once, above the router, so the two YT.Player instances are never
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
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(volume);
  const hasRestoredRef = useRef(false);
  const isFetchingRelatedRef = useRef(false);
  queueRef.current = queue;
  indexRef.current = currentIndex;
  autoplayRef.current = autoplay;
  currentTimeRef.current = currentTime;
  volumeRef.current = volume;

  // activeSlot (0 or 1) tracks which of the two players is currently
  // audible. Mirrored into both a ref (read inside callbacks/intervals,
  // where a stale closure over React state would be wrong) and state
  // (purely so the little corner video preview - see the render below -
  // can show the right iframe; nothing else needs it to re-render).
  const [activeSlot, setActiveSlot] = useState(0);
  const activeSlotRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const rampIntervalRef = useRef(null);

  const handleStateChange = useCallback((slot, event) => {
    const YT = window.YT;
    if (!YT || slot !== activeSlotRef.current) return;
    if (event.data === YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setDuration(event.target.getDuration() || 0);
    } else if (event.data === YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      persistStateRef.current();
    } else if (event.data === YT.PlayerState.ENDED) {
      setIsPlaying(false);
      // Under normal operation the crossfade trigger (below) pauses the
      // active player a moment before it would naturally end, so this
      // branch is a fallback for when that timer got missed (e.g. a
      // backgrounded tab throttles setInterval) rather than the common path.
      if (!isTransitioningRef.current) {
        endedFallbackRef.current();
      }
    } else if (event.data === YT.PlayerState.CUED) {
      // Fires after a restored track is cued (see the restore-on-mount
      // effect below) - picks up its duration so the progress bar isn't
      // stuck at 0 before the user hits Play for the first time.
      setDuration(event.target.getDuration() || 0);
    }
  }, []);

  const playerA = useYouTubePlayer(PLAYER_CONTAINER_IDS[0], {
    onStateChange: (event) => handleStateChange(0, event),
  });
  const playerB = useYouTubePlayer(PLAYER_CONTAINER_IDS[1], {
    onStateChange: (event) => handleStateChange(1, event),
  });
  const playerARef = playerA.playerRef;
  const playerBRef = playerB.playerRef;
  const isReady = playerA.isReady && playerB.isReady;
  // A player's ref is non-null the instant `new YT.Player()` is called, but
  // its API methods (setVolume, loadVideoById, ...) aren't actually attached
  // until the iframe handshake completes and onReady fires - a truthy
  // `.current` check alone isn't enough to safely call methods on it, so
  // playTrack/beginTransition below also check this (mirrored into a ref
  // since they're stable useCallbacks and can't close over the `isReady`
  // state directly without going stale).
  const isReadyRef = useRef(false);
  isReadyRef.current = isReady;

  const refForSlot = useCallback((slot) => (slot === 0 ? playerARef : playerBRef), [playerARef, playerBRef]);

  // Cleanly aborts an in-flight crossfade: stops the ramp, silences and
  // pauses whichever player was fading in, and restores the active
  // player's volume in case it was mid-fade-out. Used when a seek or a new
  // transition interrupts one already in progress.
  const cancelTransition = useCallback(() => {
    if (rampIntervalRef.current) {
      clearInterval(rampIntervalRef.current);
      rampIntervalRef.current = null;
    }
    if (isTransitioningRef.current) {
      const standby = refForSlot(1 - activeSlotRef.current).current;
      standby?.pauseVideo();
      standby?.setVolume(volumeRef.current);
      refForSlot(activeSlotRef.current).current?.setVolume(volumeRef.current);
    }
    isTransitioningRef.current = false;
  }, [refForSlot]);

  // The handoff: preload `targetIndex` on the standby player (silently),
  // start it, then ramp volume from the active player over to it. Used for
  // every track change - manual Next/Previous/queue-jump get a quick fade
  // (durationMs = CROSSFADE_DURATION_MANUAL_MS) instead of today's instant
  // cut, natural end-of-track gets the full musical crossfade. Returns
  // false (no-op) if there's no such track or a player isn't ready yet.
  const beginTransition = useCallback(
    (targetIndex, durationMs) => {
      const track = queueRef.current[targetIndex];
      const activePlayer = refForSlot(activeSlotRef.current).current;
      const standbyPlayer = refForSlot(1 - activeSlotRef.current).current;
      if (!track || !activePlayer || !standbyPlayer || !isReadyRef.current) return false;

      cancelTransition();
      isTransitioningRef.current = true;

      standbyPlayer.setVolume(0);
      standbyPlayer.loadVideoById(track.videoId);

      // Reflect the new "now playing" track the moment the fade starts,
      // not once it finishes - matches how crossfade-capable players
      // switch title/artwork immediately.
      setCurrentIndex(targetIndex);
      setCurrentTime(0);

      const steps = Math.max(1, Math.round(durationMs / CROSSFADE_TICK_MS));
      let step = 0;
      rampIntervalRef.current = setInterval(() => {
        step++;
        const progress = Math.min(1, step / steps);
        const ceiling = volumeRef.current; // read live so a mid-fade volume drag is respected
        activePlayer.setVolume(Math.round(ceiling * (1 - progress)));
        standbyPlayer.setVolume(Math.round(ceiling * progress));

        if (progress >= 1) {
          clearInterval(rampIntervalRef.current);
          rampIntervalRef.current = null;
          activePlayer.pauseVideo();
          activePlayer.setVolume(ceiling); // reset for its next turn as standby
          activeSlotRef.current = 1 - activeSlotRef.current;
          setActiveSlot(activeSlotRef.current);
          isTransitioningRef.current = false;
          // The now-active player was already playing before the flip (no
          // new PLAYING event fires), so duration/isPlaying need setting
          // explicitly rather than relying on handleStateChange.
          setDuration(standbyPlayer.getDuration() || 0);
          setIsPlaying(true);
        }
      }, CROSSFADE_TICK_MS);

      return true;
    },
    [cancelTransition, refForSlot]
  );

  // Extracted from the old goNext so both the manual Next button and the
  // proactive auto-crossfade trigger (below) can call it: fetches more
  // tracks from the local relatedPool/live-search fallback (see CLAUDE.md)
  // and appends them to the queue. A no-op while a fetch is already in
  // flight.
  const refillQueue = useCallback(async () => {
    if (isFetchingRelatedRef.current) return;
    const list = queueRef.current;
    const current = list[indexRef.current];
    if (!current) return;

    isFetchingRelatedRef.current = true;
    setIsFetchingRelated(true);
    try {
      const related = await fetchRelatedTracks(current.videoId, {
        categoryId: current.categoryId,
        channelId: current.channelId,
        excludeIds: list.map((t) => t.videoId),
      });
      const existingIds = new Set(queueRef.current.map((t) => t.videoId));
      const fresh = related.filter((t) => !existingIds.has(t.videoId));
      if (fresh.length) setQueue((prev) => [...prev, ...fresh]);
    } catch {
      // no related tracks available - the crossfade trigger / ENDED
      // fallback will simply find no next track and stop, same as before
    } finally {
      isFetchingRelatedRef.current = false;
      setIsFetchingRelated(false);
    }
  }, []);

  const goNext = useCallback(async () => {
    const idx = indexRef.current;
    if (idx + 1 < queueRef.current.length) {
      beginTransition(idx + 1, CROSSFADE_DURATION_MANUAL_MS);
      return;
    }
    if (!autoplayRef.current) return;
    await refillQueue();
    if (indexRef.current + 1 < queueRef.current.length) {
      beginTransition(indexRef.current + 1, CROSSFADE_DURATION_MANUAL_MS);
    }
  }, [beginTransition, refillQueue]);

  const goPrev = useCallback(() => {
    const idx = indexRef.current;
    if (idx > 0) beginTransition(idx - 1, CROSSFADE_DURATION_MANUAL_MS);
  }, [beginTransition]);

  // ENDED fallback (see handleStateChange) - kept behind a ref so
  // handleStateChange doesn't need goNext-shaped deps churning it on every
  // render; mirrors the seekRef/persistStateRef pattern already used below.
  const endedFallbackRef = useRef(() => {});
  endedFallbackRef.current = () => {
    const idx = indexRef.current;
    if (idx + 1 < queueRef.current.length) {
      beginTransition(idx + 1, 0);
    } else if (autoplayRef.current) {
      refillQueue().then(() => {
        if (indexRef.current + 1 < queueRef.current.length) {
          beginTransition(indexRef.current + 1, 0);
        }
      });
    }
  };

  // Persists queue/track/position/volume/autoplay so a refresh (or a new
  // device, once logged in) can pick up exactly where playback left off.
  // Always writes to localStorage (the guest-mode store) AND fire-and-forget
  // attempts the server - same decoupled pattern as recordServerPlay below,
  // so this never needs to know whether the user is actually logged in; a
  // 401/503 is silently ignored.
  const persistState = useCallback(() => {
    const list = queueRef.current;
    if (!list.length || indexRef.current < 0) return;
    const state = {
      queue: list,
      currentIndex: indexRef.current,
      currentTime: currentTimeRef.current,
      volume: volumeRef.current,
      autoplay: autoplayRef.current,
    };
    savePlayerState(state);
    saveServerPlayerState(state).catch(() => {});
  }, []);

  const persistStateRef = useRef(persistState);
  persistStateRef.current = persistState;

  useEffect(() => {
    if (isReady) {
      playerARef.current?.setVolume(volume);
      playerBRef.current?.setVolume(volume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Watches playback position while playing: proactively refills the queue
  // well before it runs out (REFILL_TRIGGER_SECONDS), then starts the
  // musical crossfade once CROSSFADE_TRIGGER_SECONDS remain and a next
  // track is available. Runs every 500ms off the position-tracking
  // interval further below.
  useEffect(() => {
    if (!isPlaying || isTransitioningRef.current || duration <= 0) return;
    const remaining = duration - currentTime;

    if (
      indexRef.current + 1 >= queueRef.current.length &&
      autoplayRef.current &&
      remaining <= REFILL_TRIGGER_SECONDS &&
      !isFetchingRelatedRef.current
    ) {
      refillQueue();
    }

    if (remaining <= CROSSFADE_TRIGGER_SECONDS && indexRef.current + 1 < queueRef.current.length) {
      beginTransition(indexRef.current + 1, CROSSFADE_DURATION_AUTO_MS);
    }
  }, [currentTime, duration, isPlaying, beginTransition, refillQueue]);

  // Restores queue/track/position across a refresh, once both players exist
  // (guaranteed by gating on isReady). Server state wins when available
  // (logged in), falling back to the localStorage guest-mode copy. Cues the
  // restored track paused rather than resuming playback automatically -
  // unmuted autoplay without a fresh user gesture is unreliable/blocked in
  // most browsers anyway, and starting audio the instant the page loads
  // would be jarring even when it isn't blocked.
  useEffect(() => {
    if (!isReady || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    let cancelled = false;

    async function restore() {
      let saved = null;
      try {
        saved = await fetchServerPlayerState();
      } catch {
        // 401 (guest) or 503 (accounts disabled) - expected, fall back below
      }
      if (!saved?.queue?.length) saved = getSavedPlayerState();
      if (cancelled || !saved?.queue?.length || saved.currentIndex < 0) return;

      const track = saved.queue[saved.currentIndex];
      if (!track) return;

      setQueue(saved.queue);
      setCurrentIndex(saved.currentIndex);
      setVolume(saved.volume ?? 80);
      setAutoplay(saved.autoplay !== false);
      setCurrentTime(saved.currentTime || 0);
      const activePlayer = refForSlot(activeSlotRef.current).current;
      activePlayer?.cueVideoById(track.videoId, saved.currentTime || 0);
      activePlayer?.setVolume(saved.volume ?? 80);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [isReady, refForSlot]);

  // Track-change is the clearest signal a listening session actually moved
  // forward, so it persists immediately rather than waiting for the next
  // interval tick. Guarded by persistState's own `indexRef.current < 0`
  // check, so this is a no-op on first mount before anything's playing (and
  // right after the restore effect above, it's a harmless re-save of what
  // was just restored).
  useEffect(() => {
    persistStateRef.current();
  }, [currentIndex]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = setInterval(() => persistStateRef.current(), PERSIST_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Catches the "closed the tab" / "switched apps" case that the interval
  // above might miss between ticks.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") persistStateRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = setInterval(() => {
      // Skip while a crossfade is in flight - the active slot hasn't
      // flipped yet, so reading its currentTime here would clobber the
      // fresh 0 that beginTransition just set with the outgoing track's
      // near-the-end position.
      if (isTransitioningRef.current) return;
      const player = refForSlot(activeSlotRef.current).current;
      if (player?.getCurrentTime) setCurrentTime(player.getCurrentTime());
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, refForSlot]);

  const playTrack = useCallback(
    (track, list) => {
      const activePlayer = refForSlot(activeSlotRef.current).current;
      if (!activePlayer || !isReadyRef.current) return;
      // Starting a fresh listening session (clicked a track elsewhere in
      // the app) isn't "advancing" an existing one, so this is an instant
      // cut, not a crossfade - also clears out any fade left mid-flight
      // from whatever was playing before.
      cancelTransition();
      const effectiveList = list && list.length ? list : [track];
      const index = effectiveList.findIndex((t) => t.videoId === track.videoId);
      const targetIndex = index === -1 ? 0 : index;

      setQueue(effectiveList);
      setCurrentIndex(targetIndex);
      setCurrentTime(0);
      activePlayer.setVolume(volumeRef.current);
      activePlayer.loadVideoById(effectiveList[targetIndex].videoId);
      setIsPlaying(true);
      recordPlay(track);
      // Fire-and-forget: a 401 (guest) or 503 (accounts disabled on this
      // deployment) is expected and silently ignored. PlayerContext never
      // imports AuthContext - this keeps the two decoupled instead of
      // depending on provider ordering.
      recordServerPlay(track).catch(() => {});
    },
    [cancelTransition, refForSlot]
  );

  const playFromQueue = useCallback(
    (absoluteIndex) => {
      beginTransition(absoluteIndex, CROSSFADE_DURATION_MANUAL_MS);
    },
    [beginTransition]
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
    const player = refForSlot(activeSlotRef.current).current;
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [refForSlot, isPlaying]);

  const seek = useCallback(
    (seconds) => {
      // Jumping around mid-fade would be confusing (which player is the
      // scrub bar even pointing at?) - cancel it and let the seek apply
      // cleanly to the active player.
      cancelTransition();
      refForSlot(activeSlotRef.current).current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    },
    [cancelTransition, refForSlot]
  );

  const seekRef = useRef(seek);
  seekRef.current = seek;

  const changeVolume = useCallback(
    (value) => {
      setVolume(value);
      // During a crossfade the ramp interval reads volumeRef.current live
      // every tick, so it picks this up on its own - setting it directly
      // here too would just be fought over and overwritten within 50ms.
      if (!isTransitioningRef.current) {
        refForSlot(activeSlotRef.current).current?.setVolume(value);
      }
    },
    [refForSlot]
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

    navigator.mediaSession.setActionHandler("play", () => refForSlot(activeSlotRef.current).current?.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => refForSlot(activeSlotRef.current).current?.pauseVideo());
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
  }, [refForSlot, goPrev, goNext]);

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
        {/* Both players stay mounted permanently (destroying either div would
            tear down its YT.Player) - only the currently-active one is shown,
            since the standby is often silently preloading/paused mid-track
            and would otherwise flash the wrong video into this corner box.
            The is-active class lives on a wrapper React fully owns, NOT on
            the inner id={...} div directly - the YouTube IFrame API replaces
            that div with an iframe at construction time (copying its class
            once), so React's virtual DOM loses track of it afterwards and
            any className toggled there later would silently never reach
            the real, live iframe. */}
        <div className={`yt-player-slot${activeSlot === 0 ? " is-active" : ""}`}>
          <div id={PLAYER_CONTAINER_IDS[0]} />
        </div>
        <div className={`yt-player-slot${activeSlot === 1 ? " is-active" : ""}`}>
          <div id={PLAYER_CONTAINER_IDS[1]} />
        </div>
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
