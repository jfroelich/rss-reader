import {assert, AssertionError} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as favicon from '/src/favicon/favicon.js';
import {Entry} from '/src/model/entry.js';
import {Feed} from '/src/model/feed.js';
import {ConstraintError, Model} from '/src/model/model.js';
import {better_fetch} from '/src/net/net.js';
import {import_entry, ImportEntryArgs} from '/src/ops/import-entry/import-entry.js';
import * as feed_parser from '/src/ops/import-feed/feed-parser.js';
import * as op_utils from '/src/ops/op-utils.js';

export function ImportFeedArgs() {
  this.feed = undefined;
  this.model = undefined;
  this.iconn = undefined;
  this.rewrite_rules = [];
  this.inaccessible_descriptors = [];
  this.create = false;
  this.fetch_feed_timeout = INDEFINITE;
  this.fetch_html_timeout = INDEFINITE;
  this.feed_stored_callback = undefined;
}

export async function import_feed(args) {
  // TEMP: transitioning to args parameter, just shove back into variables
  // TODO: think of a more elegant way to do this
  const feed = args.feed;
  const model = args.model;
  const iconn = args.iconn;
  const rewrite_rules = args.rewrite_rules;
  const inaccessible_descriptors = args.inaccessible_descriptors;
  const create = args.create;
  const fetch_feed_timeout = args.fetch_feed_timeout;
  const fetch_html_timeout = args.fetch_html_timeout;
  const feed_stored_callback = args.feed_stored_callback;

  assert(feed instanceof Feed);
  assert(model instanceof Model);
  assert(iconn === undefined || iconn instanceof IDBDatabase);
  assert(fetch_feed_timeout instanceof Deadline);

  // TEMP: monitoring new functionality
  console.debug('Importing feed', feed.getURLString());

  // If we are subscribing then check if already subscribed
  if (create) {
    const url = new URL(feed.getURLString());
    const existing_feed = await model.getFeed('url', url, /* key_only */ true);
    if (existing_feed) {
      const message = 'Already subscribed to feed with url ' + url.href;
      throw new ConstraintError(message);
    }
  } else {
    assert(Feed.isValidId(feed.id));
  }

  // Fetch the feed
  const fetch_url = new URL(feed.getURLString());
  const fetch_options = {timeout: fetch_feed_timeout};
  const response = await better_fetch(fetch_url, fetch_options);
  const response_url = new URL(response.url);

  // Check if redirected
  if (create && fetch_url.href !== response_url.href) {
    const existing_feed = await model.getFeed('url', response_url, true);
    if (existing_feed) {
      const message =
          'Already subscribed to redirected feed url ' + response_url.href;
      throw new ConstraintError(message);
    }
  }

  // Possibly append the redirect url
  feed.appendURL(response_url);

  const response_text = await response.text();
  const parsed_feed = feed_parser.parse_from_string(response_text);
  update_model_feed_from_parsed_feed(feed, parsed_feed);

  // Reset the error count when fetching and parsing were successful
  delete feed.errorCount;

  // If creating, set the favicon. If updating, skip it because we leave that
  // to refresh-feed-icons that amortizes this cost.
  if (create && iconn) {
    const lookup_url = op_utils.get_feed_favicon_lookup_url(feed);
    const request = new favicon.LookupRequest();
    request.conn = iconn;
    request.url = lookup_url;
    const icon_url = await favicon.lookup(request);
    if (icon_url) {
      feed.faviconURLString = icon_url.href;
    }
  }

  Feed.sanitize(feed);
  Feed.validate(feed);

  if (create) {
    feed.id = await model.createFeed(feed);
  } else {
    await model.updateFeed(feed, /* overwrite */ true);
  }

  // Early notify observer-caller if they are listening
  if (feed_stored_callback) {
    feed_stored_callback(feed);
  }

  // Process the entries for the feed
  const model_entries = parsed_feed.entries.map(parsed_entry_to_model_entry);
  const import_entries_results = await import_entries(
      model_entries, feed, model, iconn, rewrite_rules,
      inaccessible_descriptors, fetch_html_timeout);

  // Filter out the invalid ids. We know invalid ids will be 0 or undefined,
  // and that valid ids will be some positive integer.
  const valid_new_entry_ids = import_entries_results.filter(id => id);

  const output = {};
  output.feed = feed;
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
    entries, feed, model, iconn, rewrite_rules, inaccessible_descriptors,
    fetch_html_timeout) {
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
    args.model = model;
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
    if (error instanceof AssertionError) {
      throw error;
    } else if (error instanceof ConstraintError) {
      console.debug(
          'Skipping entry that already exists', args.entry.getURLString());
    } else {
      // Prevent the error from affecting logic, but log it for now to assist
      // in debugging. There are a plethora of unanticipated errors that could
      // be raised (e.g. ReferenceError).
      console.debug(error);
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
