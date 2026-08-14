// Curated playlist categories shown on the homepage.
// Each category is driven by one or more YouTube search queries, cached
// server-side (see services/cacheService.js) so the homepage never triggers
// a live YouTube API call on every visit.
module.exports = [
  {
    id: "sufi-romance",
    name: "Sufi & Romance",
    icon: "🎻",
    gradient: ["#c471ed", "#7f5af0"],
    queries: ["best sufi romantic songs playlist"],
  },
  {
    id: "love",
    name: "Love",
    icon: "❤️",
    gradient: ["#ff5da2", "#ff8a65"],
    queries: ["best romantic love songs hits"],
  },
  {
    id: "dance",
    name: "Dance",
    icon: "💃",
    gradient: ["#2de2e6", "#7f5af0"],
    queries: ["best dance hits playlist"],
  },
  {
    id: "party",
    name: "Party",
    icon: "🎉",
    gradient: ["#ffd23f", "#ff2ea6"],
    queries: ["best party songs anthems"],
  },
  {
    id: "dj",
    name: "DJ & Remix",
    icon: "🎧",
    gradient: ["#7f5af0", "#2de2e6"],
    queries: ["best dj remix songs playlist"],
  },
  {
    id: "90s",
    name: "90s Hits",
    icon: "📼",
    gradient: ["#ff8a65", "#7f5af0"],
    queries: ["best songs of the 90s hits"],
  },
  {
    id: "classics",
    name: "Classics",
    icon: "🎶",
    gradient: ["#f5d76e", "#c471ed"],
    queries: ["timeless classic hit songs"],
  },
  {
    id: "70s",
    name: "70s Hits",
    icon: "🕺",
    gradient: ["#f6416c", "#f9d423"],
    queries: ["best songs of the 70s hits"],
  },
  {
    id: "80s",
    name: "80s Hits",
    icon: "🕹️",
    gradient: ["#7028e4", "#e5b2ca"],
    queries: ["best songs of the 80s hits"],
  },
  {
    id: "pop-rap",
    name: "Pop & Rap",
    icon: "🎤",
    gradient: ["#00c9ff", "#92fe9d"],
    queries: ["best pop rap hits playlist"],
  },
];
