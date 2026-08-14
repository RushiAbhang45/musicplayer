import { useEffect, useRef, useState } from "react";

let apiPromise = null;

// Loads the YouTube IFrame API script exactly once per page, however many
// components/hook instances ask for it.
function loadYouTubeIframeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

// Wraps the raw window.YT lifecycle: creates a single YT.Player bound to
// `containerId` and forwards its events to the given handlers. The player
// instance itself is exposed via a ref (not state) since YT.Player mutates
// itself internally and shouldn't be treated as immutable React state.
export function useYouTubePlayer(containerId, { onReady, onStateChange, onError } = {}) {
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const handlersRef = useRef({});
  handlersRef.current = { onReady, onStateChange, onError };

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || playerRef.current) return;

      playerRef.current = new YT.Player(containerId, {
        height: "60",
        width: "90",
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            handlersRef.current.onReady?.(playerRef.current);
          },
          onStateChange: (event) => handlersRef.current.onStateChange?.(event),
          onError: (event) => handlersRef.current.onError?.(event),
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [containerId]);

  return { playerRef, isReady };
}
