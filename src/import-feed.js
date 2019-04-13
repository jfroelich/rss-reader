import assert, { isAssertError } from '/lib/assert.js';
import { betterFetch } from '/lib/better-fetch.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import * as feedParser from '/lib/feed-parser.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import { importEntry, ImportEntryArgs } from '/src/import-entry.js';
import lookupFeedFavicon from '/src/lookup-feed-favicon.js';

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
  assert(typeof db.Connection === 'function');

  assert(args instanceof ImportFeedArgs);
  assert(args.feed && typeof args.feed === 'object');
  assert(args.conn instanceof db.Connection);
  assert(args.iconn === undefined || args.iconn instanceof IDBDatabase);
  assert(args.fetchFeedTimeout instanceof Deadline);

  console.debug('Importing feed', args.feed);

  if (args.create) {
    // If we are creating a new feed, then verify that a similar feed does not
    // already exist. While this is eventually guaranteed by the unique
    // constraint in the database layer, it is better to redundantly check here
    // to avoid network overhead, which is the bottleneck.
    await validateFeedIsUnique(args.feed, args.conn);
  } else {
    assert(db.isValidId(args.feed.id));
  }

  // Fetch the feed
  const fetchURL = db.getURL(args.feed);
  const fetchOptions = { timeout: args.fetchFeedTimeout };
  const response = await betterFetch(fetchURL, fetchOptions);
  const responseURL = new URL(response.url);

  // Check if redirected
  if (args.create && fetchURL.href !== responseURL.href) {
    const existingFeed = await db.getResource({
      conn: args.conn, mode: 'url', url: responseURL, keyOnly: true
    });

    if (existingFeed) {
      const message = `Already subscribed to redirected feed url ${responseURL.href}`;
      throw new db.errors.ConstraintError(message);
    }
  }

  // Possibly append the redirect url
  db.setURL(args.feed, responseURL);

  const responseText = await response.text();
  const parsedFeed = feedParser.parseFromString(responseText);
  updateModelFeedFromParsedFeed(args.feed, parsedFeed);

  // Reset the error count when fetching and parsing were successful
  delete args.feed.errorCount;

  // If creating, set the favicon. If updating, skip it because we leave that
  // to refresh-feed-icons that amortizes this cost.
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
    args.feed.id = await db.createResource(args.conn, args.feed);
  } else {
    await db.putResource(args.conn, args.feed);
  }

  // Early notify observer-caller if they are listening that we created the
  // feed. This is useful, for example, to allow the subscription process to
  // consider the user subscribed prior to waiting for all entries to be
  // processed.
  if (args.feedStoredCallback) {
    args.feedStoredCallback(args.feed);
  }

  // Process the entries for the feed
  const modelEntries = parsedFeed.entries.map(convertParsedEntryToModelEntry);
  const importEntriesResults = await importEntries(modelEntries, args);

  // Filter out the invalid ids. We know invalid ids will be 0 or undefined,
  // and that valid ids will be some positive integer.
  const validNewEntryIds = importEntriesResults.filter(id => id);

  const output = {};
  output.feed = args.feed;
  output.entryAddCount = validNewEntryIds.length;
  return output;
}

// Concurrently import an array of entry objects. Resolves when all entries
// processed. Returns a promise that resolves when each individual import-entry
// promise resolves, which then resolves to an array of new entry ids. For all
// errors other than assertion errors, per-entry import errors are suppressed
// and only logged. If there is an error importing an entry its output id will
// be invalid.
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

    // TODO: decouple from config. In the interim I am loading from config here
    // in order to decouple import-empty from config.
    iea.filterOptions = {};
    iea.filterOptions.contrast_matte = config.readInt('contrast_default_matte');
    iea.filterOptions.contrast_ratio = config.readFloat('min_contrast_ratio');
    // TODO: read from config (temporarily hardcoded due to a bug)
    iea.filterOptions.set_image_sizes_timeout = new Deadline(7000);
    // TODO: read from config (temporarily hardcoded due to a bug)
    iea.filterOptions.setImageDimensionsTimeout = new Deadline(7000);
    iea.filterOptions.tableScanMaxRows = config.readInt('table_scan_max_rows');

    const emphasisMaxLength = config.readInt('emphasis_max_length');
    if (!isNaN(emphasisMaxLength)) {
      iea.filterOptions.emphasisMaxLength = emphasisMaxLength;
    }

    iea.filterOptions.empty_frame_body_message = 'Unable to display document because it uses HTML frames';

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
    } else if (error instanceof db.errors.ConstraintError) {
      // Ignore
    } else {
      // For debugging
      console.warn(error);
    }
  }
  return newEntryId;
}

// Copy over properties from the parsed feed and appropriately update the local
// feed object with new data. Note that response url has already been appended,
// and that the local feed may already have one or more urls.
function updateModelFeedFromParsedFeed(feed, parsedFeed) {
  feed.feed_format = parsedFeed.type;
  feed.title = parsedFeed.title;
  feed.description = parsedFeed.description;
  feed.published_date = parsedFeed.published_date;

  // Try to normalize the new link value and overwrite. The link value comes
  // from the raw data and we are not sure if it is valid.
  if (parsedFeed.link) {
    try {
      const linkURL = new URL(parsedFeed.link);
      feed.link = linkURL.href;
    } catch (error) {
      // Ignore, retain the prior link if it exists
    }
  }
}

// Throw a constraint error if the feed exists in the database. Note that this
// only checks against the tail url of the feed, so this result is unreliable
// when there are multiple urls.
async function validateFeedIsUnique(feed, conn) {
  const url = db.getURL(feed);

  const existingFeed = await db.getResource({
    conn, mode: 'url', url, keyOnly: true
  });

  if (existingFeed) {
    const message = `Already subscribed to feed with url ${url.href}`;
    throw new db.errors.ConstraintError(message);
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
