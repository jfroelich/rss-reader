import * as DBService from '/src/service/db-service.js';
import * as db from '/src/db/db.js';
import * as feedParser from '/src/lib/feed-parser.js';
import * as localStorageUtils from '/src/lib/local-storage-utils.js';
import { Deadline, INDEFINITE } from '/src/lib/deadline.js';
import { ImportEntryArgs, importEntry } from '/src/service/import-entry.js';
import { betterFetch } from '/src/lib/better-fetch.js';
import assert, { isAssertError } from '/src/lib/assert.js';
import lookupFeedFavicon from '/src/service/utils/lookup-feed-favicon.js';

export function ImportFeedArgs() {
  this.feed = undefined;
  this.conn = undefined;
  this.iconn = undefined;
  this.rewriteRules = [];
  this.inaccessibleContentDescriptors = [];
  this.create = false;
  this.fetchFeedTimeout = INDEFINITE;
  this.fetchHTMLTimeout = INDEFINITE;
  this.feedStoredCallback = undefined;
}

export async function importFeed(args) {
  assert(args instanceof ImportFeedArgs);
  assert(args.feed && typeof args.feed === 'object');
  assert(args.iconn === undefined || args.iconn instanceof IDBDatabase);
  assert(args.fetchFeedTimeout instanceof Deadline);

  console.debug('Importing feed', args.feed);

  if (args.create) {
    // If we are creating a new feed, then verify that a similar feed does not already exist. While
    // this is eventually guaranteed by the uniqueness constraint in the database layer, it is
    // better to redundantly check here to avoid network overhead.
    await validateFeedIsUnique(args.feed, args.conn);
  } else {
    assert(db.isValidId(args.feed.id));
  }

  // Fetch the feed
  const fetchURL = new URL(args.feed.urls[args.feed.urls.length - 1]);
  const fetchOptions = { timeout: args.fetchFeedTimeout };
  const response = await betterFetch(fetchURL, fetchOptions);
  const responseURL = new URL(response.url);

  // Check if redirected
  if (args.create && fetchURL.href !== responseURL.href) {
    const existingFeed = await DBService.getFeed(args.conn, {
      mode: 'url', url: responseURL, keyOnly: true
    });

    if (existingFeed) {
      const message = `Already subscribed to redirected feed url ${responseURL.href}`;
      throw new DBService.ConstraintError(message);
    }
  }

  // Possibly append the redirect url
  db.setURL(args.feed, responseURL);

  const responseText = await response.text();
  const parsedFeed = feedParser.parseFromString(responseText);
  updateModelFeedFromParsedFeed(args.feed, parsedFeed);

  // Reset the error count when fetching and parsing were successful
  delete args.feed.errorCount;

  // If creating, set the favicon. If updating, skip it because we leave that to refresh-feed-icons
  // that amortizes this cost.
  if (args.create && args.iconn) {
    const iconURL = await lookupFeedFavicon(args.feed, args.iconn);
    if (iconURL) {
      args.feed.favicon_url = iconURL.href;
    }
  }

  // init as active
  if (args.create) {
    args.feed.active = 1;
  }

  if (args.create) {
    args.feed.id = await DBService.createFeed(args.conn, args.feed);
  } else {
    await DBService.putFeed(args.conn, args.feed);
  }

  // Early notify observer-caller if they are listening that we created the feed. This is useful,
  // for example, to allow the subscription process to consider the user subscribed prior to waiting
  // for all entries to be processed.
  if (args.feedStoredCallback) {
    args.feedStoredCallback(args.feed);
  }

  // Process the entries for the feed
  const modelEntries = parsedFeed.entries.map(convertParsedEntryToModelEntry);
  const importEntriesResults = await importEntries(modelEntries, args);

  // Filter out the invalid ids. We know invalid ids will be 0 or undefined, and that valid ids will
  // be some positive integer.
  const validNewEntryIds = importEntriesResults.filter(id => id);

  const output = {};
  output.feed = args.feed;
  output.entryAddCount = validNewEntryIds.length;
  return output;
}

// Concurrently import an array of entry objects. Resolves when all entries processed. Returns a
// promise that resolves when each individual import-entry promise resolves, which then resolves to
// an array of new entry ids. For all errors other than assertion errors, per-entry import errors
// are suppressed and only logged. If there is an error importing an entry its output id will be
// invalid.
function importEntries(entries, args) {
  // Map each entry into an import-entry promise
  const promises = entries.map((entry) => {
    // Propagate feed information down to the entry
    entry.feed = args.feed.id;
    entry.feed_title = args.feed.title;
    entry.favicon_url = args.feed.favicon_url;
    entry.published_date = entry.published_date || args.feed.published_date;

    const iea = new ImportEntryArgs();
    iea.entry = entry;
    iea.feed = args.feed;
    iea.conn = args.conn;
    iea.iconn = args.iconn;
    iea.rewriteRules = args.rewriteRules;
    iea.inaccessibleContentDescriptors = args.inaccessibleContentDescriptors;
    iea.fetchHTMLTimeout = args.fetchHTMLTimeout;

    // TODO: decouple from local storage
    iea.filterOptions = {};
    iea.filterOptions.contrastMatte = localStorageUtils.readInt('contrast_default_matte');
    iea.filterOptions.contrastRatio = localStorageUtils.readFloat('min_contrast_ratio');
    // TODO: decouple from local storage, but also do not hardcode
    iea.filterOptions.reachableImageFilterTimeout = new Deadline(7000);
    iea.filterOptions.imageDimensionsFilterTimeout = new Deadline(7000);
    iea.filterOptions.tableScanMaxRows = localStorageUtils.readInt('table_scan_max_rows');

    const emphasisMaxLength = localStorageUtils.readInt('emphasis_max_length');
    if (!isNaN(emphasisMaxLength)) {
      iea.filterOptions.emphasisMaxLength = emphasisMaxLength;
    }

    iea.filterOptions.emptyFrameBodyMessage = 'Unable to display document because it uses HTML frames';

    return importEntryNoexcept(iea);
  });
  return Promise.all(promises);
}

// Calls importEntry and traps all errors except for assertion errors.
async function importEntryNoexcept(args) {
  let newEntryId = 0;
  try {
    newEntryId = await importEntry(args);
  } catch (error) {
    if (isAssertError(error)) {
      throw error;
    } else if (error instanceof DBService.ConstraintError) {
      // Ignore
    } else {
      // For debugging
      console.warn(error);
    }
  }
  return newEntryId;
}

// Copy over properties from the parsed feed and appropriately update the local feed object with new
// data. Note that response url has already been appended, and that the local feed may already have
// one or more urls.
function updateModelFeedFromParsedFeed(feed, parsedFeed) {
  feed.feed_format = parsedFeed.type;
  feed.title = parsedFeed.title;
  feed.description = parsedFeed.description;
  feed.published_date = parsedFeed.published_date;

  // Try to normalize the new link value and overwrite. The link value comes from the raw data and
  // we are not sure if it is valid.
  if (parsedFeed.link) {
    try {
      const linkURL = new URL(parsedFeed.link);
      feed.link = linkURL.href;
    } catch (error) {
      // Ignore, retain the prior link if it exists
    }
  }
}

// Throw a constraint error if the feed exists in the database. Note that this only checks against
// the tail url of the feed, so this result is unreliable when there are multiple urls.
async function validateFeedIsUnique(feed, conn) {
  const url = new URL(feed.urls[feed.urls.length - 1]);

  const existingFeed = await DBService.getFeed(conn, { mode: 'url', url, keyOnly: true });

  if (existingFeed) {
    const message = `Already subscribed to feed with url ${url.href}`;
    throw new DBService.ConstraintError(message);
  }
}

// Convert a parsed entry into a storable entry
function convertParsedEntryToModelEntry(parsedEntry) {
  const entry = {};
  entry.title = parsedEntry.title;
  entry.author = parsedEntry.author;
  entry.published_date = parsedEntry.published_date;
  entry.content = parsedEntry.content;
  entry.enclosure = parsedEntry.enclosure;

  if (parsedEntry.link) {
    try {
      const linkURL = new URL(parsedEntry.link);
      db.setURL(entry, linkURL);
    } catch (error) {
      // Ignore
    }
  }
  return entry;
}
