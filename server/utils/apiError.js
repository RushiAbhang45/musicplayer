// Detects YouTube's "daily quota exceeded" error so routes can show a clear
// message instead of a generic failure. YouTube returns this as a 429 (or
// sometimes 403) with a reason of quotaExceeded/rateLimitExceeded.
function isQuotaExceeded(err) {
  const status = err.response?.status;
  const reason = err.response?.data?.error?.errors?.[0]?.reason || "";
  return status === 429 || status === 403 || /quota|rateLimitExceeded/i.test(reason);
}

function sendApiError(res, err, fallbackMessage) {
  if (isQuotaExceeded(err)) {
    return res.status(429).json({
      error: "quota_exceeded",
      message: "Daily YouTube search limit reached. Please try again later.",
    });
  }
  res.status(500).json({ error: "request_failed", message: fallbackMessage });
}

module.exports = { isQuotaExceeded, sendApiError };
