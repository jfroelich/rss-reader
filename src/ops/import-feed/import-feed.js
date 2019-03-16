import {assert, is_assert_error_like} from '/src/assert.js';
import {better_fetch} from '/src/better-fetch/better-fetch.js';
import {ConstraintError} from '/src/db/errors.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import update_feed from '/src/db/ops/update-feed.js';
import {Entry} from '/src/db/types/entry.js';
import {Feed} from '/src/db/types/feed.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import {import_entry, ImportEntryArgs} from '/src/ops/import-entry/import-entry.js';
import * as feed_parser from '/src/ops/import-feed/feed-parser.js';
import {lookup_feed_favicon} from '/src/ops/lookup-feed-favicon.js';

export function ImportFeedArgs() {
  this.feed = undefined;
  this.conn = undefined;
  this.channel = undefined;
  this.iconn = undefined;
  this.rewrite_rules = [];
  this.inaccessible_descriptors = [];
  this.create = false;
  this.fetch_feed_timeout = INDEFINITE;
  this.fetch_html_timeout = INDEFINITE;
  this.feed_stored_callback = undefined;
}

export async function import_feed(args) {
  assert(args instanceof ImportFeedArgs);
  assert(args.feed instanceof Feed);
  assert(args.conn instanceof IDBDatabase);
  assert(args.channel);
  assert(args.iconn === undefined || args.iconn instanceof IDBDatabase);
  assert(args.fetch_feed_timeout instanceof Deadline);

  // If we are subscribing then check if already subscribed
  if (args.create) {
    const url = new URL(args.feed.getURLString());
    const existing_feed =
        await get_feed(args.conn, 'url', url, /* key_only */ true);
    if (existing_feed) {
      const message = 'Already subscribed to feed with url ' + url.href;
      throw new ConstraintError(message);
    }
  } else {
    assert(Feed.isValidId(args.feed.id));
  }

  // Fetch the feed
  const fetch_url = new URL(args.feed.getURLString());
  const fetch_options = {timeout: args.fetch_feed_timeout};
  const response = await better_fetch(fetch_url, fetch_options);
  const response_url = new URL(response.url);

  // Check if redirected
  if (args.create && fetch_url.href !== response_url.href) {
    const existing_feed =
        await get_feed(args.conn, 'url', response_url, /* key_only */ true);
    if (existing_feed) {
      const message =
          'Already subscribed to redirected feed url ' + response_url.href;
      throw new ConstraintError(message);
    }
  }

  // Possibly append the redirect url
  args.feed.appendURL(response_url);

  const response_text = await response.text();
  const parsed_feed = feed_parser.parse_from_string(response_text);
  update_model_feed_from_parsed_feed(args.feed, parsed_feed);

  // Reset the error count when fetching and parsing were successful
  delete args.feed.errorCount;

  // If creating, set the favicon. If updating, skip it because we leave that
  // to refresh-feed-icons that amortizes this cost.
  if (args.create && args.iconn) {
    const icon_url = await lookup_feed_favicon(args.feed, args.iconn);
    if (icon_url) {
      args.feed.faviconURLString = icon_url.href;
    }
  }

  Feed.sanitize(args.feed);
  Feed.validate(args.feed);

  if (args.create) {
    args.feed.id = await create_feed(args.conn, args.channel, args.feed);
  } else {
    await update_feed(args.conn, args.channel, args.feed, /* overwrite */ true);
  }

  // Early notify observer-caller if they are listening
  if (args.feed_stored_callback) {
    args.feed_stored_callback(args.feed);
  }

  // Process the entries for the feed
  const model_entries = parsed_feed.entries.map(parsed_entry_to_model_entry);
  const import_entries_results = await import_entries(
      model_entries, args.feed, args.conn, args.iconn, args.channel,
      args.rewrite_rules, args.inaccessible_descriptors,
      args.fetch_html_timeout);

  // Filter out the invalid ids. We know invalid ids will be 0 or undefined,
  // and that valid ids will be some positive integer.
  const valid_new_entry_ids = import_entries_results.filter(id => id);

  const output = {};
  output.feed = args.feed;
  output.entry_add_count = valid_new_entry_ids.length;
  return output;
}

// Concurrently import an array of entries (of type model/Entry). Resolves when
// all entries processed. Returns a promise that resolves when each individual
// import-entry promise resolves, which then resolves to an array of new entry
// ids. For all errors other than assertion errors, per-entry import errors are
// suppressed and only logged. If there is an error importing an entry its
// output id will be invalid.
// TODO: do something more elegant with this mess of parameters
function import_entries(
    entries, feed, conn, iconn, channel, rewrite_rules,
    inaccessible_descriptors, fetch_html_timeout) {
  // Map each entry into an import-entry promise
  const promises = entries.map(entry => {
    // Propagate feed information down to the entry
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;
    entry.datePublished = entry.datePublished || feed.datePublished;

    const args = new ImportEntryArgs();
    args.entry = entry;
    args.feed = feed;
    args.conn = conn;
    args.channel = channel;
    args.iconn = iconn;
    args.rewrite_rules = rewrite_rules;
    args.inaccessible_descriptors = inaccessible_descriptors;
    args.fetch_html_timeout = fetch_html_timeout;

    const import_promise = import_entry_noexcept(args);
    return import_promise;
  });
  return Promise.all(promises);
}

// Calls import_entry and traps all errors except for assertion errors
// TODO: this is a good opportunity to review my understanding of promise.catch
// semantics as an alternative to awaited promise try/catch. I am not sure which
// is simpler. I kind of prefer to minimize the use of the async qualifier.
async function import_entry_noexcept(args) {
  let new_entry_id = 0;
  try {
    new_entry_id = await import_entry(args);
  } catch (error) {
    if (is_assert_error_like(error)) {
      throw error;
    } else if (error instanceof ConstraintError) {
      // Ignore
    } else {
      // Prevent the error from affecting logic, but log it for now to assist
      // in debugging.
      console.warn(error);
    }
  }
  return new_entry_id;
}

// Copy over properties from the parsed feed and appropriately update the local
// feed object with new data. Note that response url has already been appended,
// and that the local feed may already have one or more urls. Note that this
// updates by reference so it produces side effects on the input.
function update_model_feed_from_parsed_feed(feed, parsed_feed) {
  feed.type = parsed_feed.type;
  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.datePublished = parsed_feed.date_published;

  // Try to normalize the new link value and overwrite. The link value comes
  // from the raw data and we are not sure if it is valid or if it is in the
  // normalized form that is used for comparison to other urls.
  if (parsed_feed.link) {
    try {
      const link_url = new URL(parsed_feed.link);
      feed.link = link_url.href;
    } catch (error) {
      // Ignore
    }
  }
}

// Convert feed-parser/Entry into model/Entry
function parsed_entry_to_model_entry(parsed_entry) {
  const entry = new Entry();
  entry.title = parsed_entry.title;
  entry.author = parsed_entry.author;
  entry.datePublished = parsed_entry.date_published;
  entry.content = parsed_entry.content;
  entry.enclosure = parsed_entry.enclosure;

  if (parsed_entry.link) {
    try {
      const link_url = new URL(parsed_entry.link);
      entry.appendURL(link_url);
    } catch (error) {
      // Ignore
    }
  }
  return entry;
}
