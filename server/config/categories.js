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
    queries: ["best bollywood sufi romantic hindi songs playlist"],
  },
  {
    id: "love",
    name: "Love",
    icon: "❤️",
    gradient: ["#ff5da2", "#ff8a65"],
    queries: ["best bollywood romantic love hindi songs hits"],
  },
  {
    id: "dance",
    name: "Dance",
    icon: "💃",
    gradient: ["#2de2e6", "#7f5af0"],
    queries: ["best bollywood dance hindi hits playlist"],
  },
  {
    id: "party",
    name: "Party",
    icon: "🎉",
    gradient: ["#ffd23f", "#ff2ea6"],
    queries: ["best bollywood party hindi songs anthems"],
  },
  {
    id: "dj",
    name: "DJ & Remix",
    icon: "🎧",
    gradient: ["#7f5af0", "#2de2e6"],
    queries: ["best bollywood dj remix hindi songs playlist"],
  },
  {
    id: "90s",
    name: "90s Hits",
    icon: "📼",
    gradient: ["#ff8a65", "#7f5af0"],
    queries: ["best bollywood 90s hindi songs hits"],
  },
  {
    id: "classics",
    name: "Classics",
    icon: "🎶",
    gradient: ["#f5d76e", "#c471ed"],
    queries: ["timeless bollywood classic hindi songs"],
  },
  {
    id: "70s",
    name: "70s Hits",
    icon: "🕺",
    gradient: ["#f6416c", "#f9d423"],
    queries: ["best bollywood 70s hindi songs hits"],
  },
  {
    id: "80s",
    name: "80s Hits",
    icon: "🕹️",
    gradient: ["#7028e4", "#e5b2ca"],
    queries: ["best bollywood 80s hindi songs hits"],
  },
  {
    id: "pop-rap",
    name: "Pop & Rap",
    icon: "🎤",
    gradient: ["#00c9ff", "#92fe9d"],
    queries: ["best indian pop rap hindi hits playlist"],
  },
];
