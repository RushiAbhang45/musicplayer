const jwt = require("jsonwebtoken");
const { isDbConfigured } = require("../db");

const COOKIE_NAME = "token";
const JWT_EXPIRY_SECONDS = 30 * 24 * 3600; // 30 days, sliding (reissued below)

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    // Netlify (frontend) and Render (backend) are different origins in
    // production, which needs SameSite=None + Secure. Plain http://localhost
    // in dev rejects Secure cookies, so dev needs Lax + insecure instead.
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: JWT_EXPIRY_SECONDS * 1000,
    path: "/",
  };
}

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY_SECONDS,
  });
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function requireAuth(req, res, next) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: "accounts_disabled" });
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  req.user = { id: payload.userId, email: payload.email };
  // Sliding expiry: an active user stays logged in indefinitely, an
  // abandoned session lapses 30 days after its last authenticated request.
  setAuthCookie(res, req.user);
  next();
}

module.exports = { requireAuth, setAuthCookie, clearAuthCookie, cookieOptions, COOKIE_NAME };
