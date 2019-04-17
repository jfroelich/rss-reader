import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import * as rss from '/src/service/resource-storage-service.js';
import { Deadline } from '/src/lib/deadline.js';
import { ImportFeedArgs, importFeed } from '/src/service/import-feed.js';
import assert, { isAssertError } from '/src/lib/assert.js';
import showNotification from '/src/service/utils/show-notification.js';

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
  this.rewriteRules = config.readArray('rewrite_rules');
  this.inaccessible_content_descriptors = config.readArray('inaccessible_content_descriptors');
}

export async function pollFeeds(args) {
  console.log('Polling feeds...');

  // Cancel the run if the last run was too recent
  if (args.recencyPeriod && !args.ignoreRecencyCheck) {
    const stamp = config.readInt('last_poll_timestamp');
    if (!isNaN(stamp)) {
      const now = new Date();
      const stampDate = new Date(stamp);
      const millisElapsed = now - stampDate;
      assert(millisElapsed >= 0);
      if (millisElapsed < args.recencyPeriod) {
        console.debug('Polled too recently', millisElapsed);
        return 0;
      }
    }
  }

  localStorage.last_poll_timestamp = `${Date.now()}`;

  const feeds = await rss.getFeeds(args.conn, { mode: 'active-feeds', titleSort: false });
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
    return pollFeedNoexcept(ifa);
  });
  // Wait for all concurrent polls to complete
  const importFeedResults = await Promise.all(promises);

  // Calculate the total number of entries added across all feeds.
  let entryAddCountTotal = 0;
  for (const entryAddCount of importFeedResults) {
    entryAddCountTotal += entryAddCount;
  }

  if (args.notify && entryAddCountTotal > 0) {
    showNotification(`Added ${entryAddCountTotal} articles`);
  }

  console.log('Poll feeds completed');
  return entryAddCountTotal;
}

// Wrap the call to import-feed, trap all errors except assertion errors.
async function pollFeedNoexcept(importFeedArgs) {
  let result;
  try {
    result = await importFeed(importFeedArgs);
  } catch (error) {
    if (isAssertError(error)) {
      throw error;
    } else {
      console.warn('Error polling feed', db.getURLString(importFeedArgs.feed), error);
      return 0;
    }
  }

  return result.entryAddCount;
}
