// See license.md
'use strict';

// Archive entries from the console
async function cmd_archive_entries() {
  // Leave undefined so that the function uses the default
  let max_age_ms;
  // Assume if calling from console that verbosity is desired
  const verbose = true;
  // Run without try/catch, allow errors to bubble
  const num_entries_archived = await archive_entries(max_age_ms, verbose);
  return num_entries_archived;
}

// Check for updated console from the console
async function cmd_poll_feeds() {
  // In this context, we want verbose logging and we want to avoid the typical
  // reasons for avoiding polling.
  const flags = POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS |
    POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE |
    POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK |
    POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK |
    POLL_FEEDS_FLAGS.VERBOSE;

  let recency_period_ms, idle_period_secs, fetch_feed_timeout_ms,
    fetch_html_timeout_ms, fetch_img_timeout_ms;
  await poll_feeds(idle_period_secs, recency_period_ms,
    fetch_feed_timeout_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    flags);
}
