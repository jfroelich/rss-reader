import * as config from '/src/config/config.js';
import * as desknote from '/src/desknote/desknote.js';
import {assert, AssertionError} from '/src/assert.js';
import {Deadline} from '/src/deadline/deadline.js';
import {Feed} from '/src/model/feed.js';
import {import_feed, ImportFeedArgs} from '/src/ops/import-feed/import-feed.js';

export function PollFeedsArgs() {
  this.ignore_recency_check = false;
  this.recency_period = 5 * 60 * 1000;
  this.fetch_feed_timeout = new Deadline(5000);
  this.fetch_html_timeout = new Deadline(5000);
  this.fetch_image_timeout = new Deadline(3000);
  this.deactivation_threshold = 10;
  this.notify = true;
  this.model = undefined;
  this.iconn = undefined;
  this.rewrite_rules = config.get_rewrite_rules();
  this.inaccessible_content_descriptors =
      config.get_inaccessible_content_descriptors();
}

export async function poll_feeds(args) {
  // Cancel the run if the last run was too recent
  if (args.recency_period && !args.ignore_recency_check) {
    // TODO: load from config
    const stamp = parseInt(localStorage.last_poll_date, 10);
    if (!isNaN(stamp)) {
      const now = new Date();
      const stamp_date = new Date(stamp);
      const millis_elapsed = now - stamp_date;
      assert(millis_elapsed >= 0);
      if (millis_elapsed < args.recency_period) {
        console.debug('Polled too recently', millis_elapsed);
        return;
      }
    }
  }

  localStorage.last_poll_date = '' + Date.now();

  const feeds = await args.model.getFeeds('active', /*sort*/ false);
  console.debug('Loaded %d active feeds for polling', feeds.length);

  // Concurrently process the feed data
  const promises = feeds.map(feed => {
    // Convert the data object loaded from the database into a Feed
    const model_feed = Object.assign(new Feed(), feed);

    const import_feed_args = new ImportFeedArgs();
    import_feed_args.feed = model_feed;
    import_feed_args.model = args.model;
    import_feed_args.iconn = args.iconn;
    import_feed_args.rewrite_rules = args.rewrite_rules;
    import_feed_args.inaccessible_descriptors =
        args.inaccessible_content_descriptors;
    import_feed_args.create = false;
    import_feed_args.fetch_feed_timeout = args.fetch_feed_timeout;
    import_feed_args.fetch_html_timeout = args.fetch_html_timeout;
    import_feed_args.feed_stored_callback = function() {};
    return poll_feed_noexcept(import_feed_args);
  });
  const import_feed_results = await Promise.all(promises);

  // Calculate the total number of entries added across all feeds.
  let entry_add_count_total = 0;
  for (const entry_add_count of import_feed_results) {
    entry_add_count_total += entry_add_count;
  }

  if (args.notify && entry_add_count_total > 0) {
    const note = {};
    note.title = 'Added articles';
    note.message = 'Added ' + entry_add_count_total + ' articles';
    desknote.show(note);
  }

  console.debug(
      'Poll feeds completed, added %d entries', entry_add_count_total);
}

// Wrap the call to import-feed, trap all errors except assertion errors.
async function poll_feed_noexcept(import_feed_args) {
  let result;
  try {
    result = await import_feed(import_feed_args);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      console.debug(error);
      return 0;
    }
  }

  return result.entry_add_count;
}
