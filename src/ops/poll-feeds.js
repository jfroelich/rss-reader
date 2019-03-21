import * as config from '/src/config/config.js';
import Feed from '/src/db/feed.js';
import get_feeds from '/src/db/ops/get-feeds.js';
import show_notification from '/src/extension/show-notification.js';
import assert from '/src/lib/assert.js';
import {is_assert_error_like} from '/src/lib/assert.js';
import {Deadline} from '/src/lib/deadline.js';
import {import_feed, ImportFeedArgs} from '/src/ops/import-feed.js';

export function PollFeedsArgs() {
  this.ignore_recency_check = false;
  this.recency_period = 5 * 60 * 1000;
  this.fetch_feed_timeout = new Deadline(5000);
  this.fetch_html_timeout = new Deadline(5000);
  this.fetch_image_timeout = new Deadline(3000);
  this.deactivation_threshold = 10;
  this.notify = true;
  this.conn = undefined;
  this.channel = undefined;
  this.iconn = undefined;
  this.rewrite_rules = config.get_rewrite_rules();
  this.inaccessible_content_descriptors =
      config.get_inaccessible_content_descriptors();
}

export async function poll_feeds(args) {
  // Cancel the run if the last run was too recent
  if (args.recency_period && !args.ignore_recency_check) {
    const stamp = config.read_int('last_poll_timestamp');
    if (!isNaN(stamp)) {
      const now = new Date();
      const stamp_date = new Date(stamp);
      const millis_elapsed = now - stamp_date;
      assert(millis_elapsed >= 0);
      if (millis_elapsed < args.recency_period) {
        console.debug('Polled too recently', millis_elapsed);
        return 0;
      }
    }
  }

  localStorage.last_poll_timestamp = '' + Date.now();

  const feeds = await get_feeds(args.conn, 'active', /*sort*/ false);
  console.debug('Loaded %d active feeds for polling', feeds.length);

  // Concurrently process the feed data
  const promises = feeds.map(feed => {
    // Convert the data object loaded from the database into a Feed
    const model_feed = Object.assign(new Feed(), feed);

    const import_feed_args = new ImportFeedArgs();
    import_feed_args.feed = model_feed;
    import_feed_args.conn = args.conn;
    import_feed_args.channel = args.channel;
    import_feed_args.iconn = args.iconn;
    import_feed_args.rewrite_rules = args.rewrite_rules;
    import_feed_args.inaccessible_descriptors =
        args.inaccessible_content_descriptors;
    import_feed_args.create = false;
    import_feed_args.fetch_feed_timeout = args.fetch_feed_timeout;
    import_feed_args.fetch_html_timeout = args.fetch_html_timeout;
    import_feed_args.feed_stored_callback = undefined;
    return poll_feed_noexcept(import_feed_args);
  });
  const import_feed_results = await Promise.all(promises);

  // Calculate the total number of entries added across all feeds.
  let entry_add_count_total = 0;
  for (const entry_add_count of import_feed_results) {
    entry_add_count_total += entry_add_count;
  }

  if (args.notify && entry_add_count_total > 0) {
    show_notification('Added ' + entry_add_count_total + ' articles');
  }

  return entry_add_count_total;
}

// Wrap the call to import-feed, trap all errors except assertion errors.
async function poll_feed_noexcept(import_feed_args) {
  let result;
  try {
    result = await import_feed(import_feed_args);
  } catch (error) {
    if (is_assert_error_like(error)) {
      throw error;
    } else {
      console.debug(error);
      return 0;
    }
  }

  return result.entry_add_count;
}
