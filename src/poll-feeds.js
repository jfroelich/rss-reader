import assert from '/lib/assert.js';
import { isAssertError } from '/lib/assert.js';
import { Deadline } from '/lib/deadline.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import { importFeed, ImportFeedArgs } from '/src/import-feed.js';
import showNotification from '/src/show-notification.js';

export function PollFeedsArgs() {
  this.ignoreRecencyCheck = false;
  this.recencyPeriod = 5 * 60 * 1000;
  this.fetchFeedTimeout = new Deadline(5000);
  this.fetchHTMLTimeout = new Deadline(5000);
  this.fetchImageTimeout = new Deadline(3000);
  this.deactivation_threshold = 10;
  this.notify = true;
  this.conn = undefined;
  this.iconn = undefined;
  this.rewriteRules = config.getRewriteRules();
  this.inaccessible_content_descriptors = config.getInaccessibleContentDescriptors();
}

export async function pollFeeds(args) {
  console.log('Polling feeds...');

  // Cancel the run if the last run was too recent
  if (args.recencyPeriod && !args.ignoreRecencyCheck) {
    const stamp = config.readInt('last_poll_timestamp');
    if (!isNaN(stamp)) {
      const now = new Date();
      const stamp_date = new Date(stamp);
      const millis_elapsed = now - stamp_date;
      assert(millis_elapsed >= 0);
      if (millis_elapsed < args.recencyPeriod) {
        console.debug('Polled too recently', millis_elapsed);
        return 0;
      }
    }
  }

  localStorage.last_poll_timestamp = `${Date.now()}`;

  const feeds = await db.getResources(
    { conn: args.conn, mode: 'active-feeds', titleSort: false },
  );
  console.debug('Loaded %d active feeds for polling', feeds.length);

  // Start concurrently polling each feed resource
  const promises = feeds.map((feed) => {
    const ifa = new ImportFeedArgs();
    ifa.feed = feed;
    ifa.conn = args.conn;
    ifa.iconn = args.iconn;
    ifa.rewriteRules = args.rewriteRules;
    ifa.inaccessibleContentDescriptors = args.inaccessible_content_descriptors;
    ifa.create = false;
    ifa.fetchFeedTimeout = args.fetchFeedTimeout;
    ifa.fetchHTMLTimeout = args.fetchHTMLTimeout;
    ifa.feedStoredCallback = undefined;
    return poll_feed_noexcept(ifa);
  });
  // Wait for all concurrent polls to complete
  const import_feed_results = await Promise.all(promises);

  // Calculate the total number of entries added across all feeds.
  let entry_add_count_total = 0;
  for (const entryAddCount of import_feed_results) {
    entry_add_count_total += entryAddCount;
  }

  if (args.notify && entry_add_count_total > 0) {
    showNotification(`Added ${entry_add_count_total} articles`);
  }

  console.log('Poll feeds completed');
  return entry_add_count_total;
}

// Wrap the call to import-feed, trap all errors except assertion errors.
async function poll_feed_noexcept(import_feed_args) {
  let result;
  try {
    result = await importFeed(import_feed_args);
  } catch (error) {
    if (isAssertError(error)) {
      throw error;
    } else {
      console.warn(
        'Error polling feed', db.getURLString(import_feed_args.feed),
        error,
      );
      return 0;
    }
  }

  return result.entryAddCount;
}
