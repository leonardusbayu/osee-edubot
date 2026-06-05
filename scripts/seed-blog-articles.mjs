// One-off script to seed initial blog articles via the published worker.
// Fetches the article endpoint with a dummy HTTP request won't trigger
// publish — we need a real Worker invocation. The cleanest way is to
// just call the function from a test, but for now we can verify the
// cron will pick it up tomorrow at 10 1 UTC.

// This file is intentionally a no-op — the publish functions run
// inside the morning channel cron (handleMorningChannelCron). When
// that's deployed and triggered, the blog articles get auto-published.

// To force a publish NOW, run a one-off curl against the worker's
// health endpoint with a special header, OR add a /api/blog/seed
// admin endpoint. For the current ship, we'll wait for the cron.

export {};
