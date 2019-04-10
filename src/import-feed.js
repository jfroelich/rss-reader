import assert from '/lib/assert.js';
import {is_assert_error} from '/lib/assert.js';
import {better_fetch} from '/lib/better-fetch.js';
import {Deadline, INDEFINITE} from '/lib/deadline.js';
import * as feed_parser from '/lib/feed-parser.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import {import_entry, ImportEntryArgs} from '/src/import-entry.js';
import lookup_feed_favicon from '/src/lookup-feed-favicon.js';

export function ImportFeedArgs() {
  this.feed = undefined;
  this.conn = undefined;
  this.iconn = undefined;
  this.rewrite_rules = [];
  this.inaccessible_descriptors = [];
  this.create = false;
  this.fetch_feed_timeout = INDEFINITE;
  this.fetch_html_timeout = INDEFINITE;
  this.feed_stored_callback = undefined;
}

export async function import_feed(args) {
  assert(typeof db.Connection === 'function');

  assert(args instanceof ImportFeedArgs);
  assert(args.feed && typeof args.feed === 'object');
  assert(args.conn instanceof db.Connection);
  assert(args.iconn === undefined || args.iconn instanceof IDBDatabase);
  assert(args.fetch_feed_timeout instanceof Deadline);

  console.debug('Importing feed', args.feed);

  if (args.create) {
    // If we are creating a new feed, then verify that a similar feed does not
    // already exist. While this is eventually guaranteed by the unique
    // constraint in the database layer, it is better to redundantly check here
    // to avoid network overhead, which is the bottleneck.
    await validate_feed_is_unique(args.feed, args.conn);
  } else {
    assert(db.is_valid_id(args.feed.id));
  }

  // Fetch the feed
  const fetch_url = db.get_url(args.feed);
  const fetch_options = {timeout: args.fetch_feed_timeout};
  const response = await better_fetch(fetch_url, fetch_options);
  const response_url = new URL(response.url);

  // Check if redirected
  if (args.create && fetch_url.href !== response_url.href) {
    const existing_feed = await db.get_resource(
        {conn: args.conn, mode: 'url', url: response_url, key_only: true});
    if (existing_feed) {
      const message =
          'Already subscribed to redirected feed url ' + response_url.href;
      throw new db.errors.ConstraintError(message);
    }
  }

  // Possibly append the redirect url
  db.set_url(args.feed, response_url);

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
      args.feed.favicon_url = icon_url.href;
    }
  }

  // init as active
  if (args.create) {
    args.feed.active = 1;
  }

  if (args.create) {
    args.feed.id = await db.create_resource(args.conn, args.feed);
  } else {
    await db.put_resource(args.conn, args.feed);
  }

  // Early notify observer-caller if they are listening that we created the
  // feed. This is useful, for example, to allow the subscription process to
  // consider the user subscribed prior to waiting for all entries to be
  // processed.
  if (args.feed_stored_callback) {
    args.feed_stored_callback(args.feed);
  }

  // Process the entries for the feed
  const model_entries = parsed_feed.entries.map(parsed_entry_to_model_entry);
  const import_entries_results = await import_entries(model_entries, args);

  // Filter out the invalid ids. We know invalid ids will be 0 or undefined,
  // and that valid ids will be some positive integer.
  const valid_new_entry_ids = import_entries_results.filter(id => id);

  const output = {};
  output.feed = args.feed;
  output.entry_add_count = valid_new_entry_ids.length;
  return output;
}

// Concurrently import an array of entry objects. Resolves when all entries
// processed. Returns a promise that resolves when each individual import-entry
// promise resolves, which then resolves to an array of new entry ids. For all
// errors other than assertion errors, per-entry import errors are suppressed
// and only logged. If there is an error importing an entry its output id will
// be invalid.
function import_entries(entries, args) {
  // Map each entry into an import-entry promise
  const promises = entries.map(entry => {
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
    iea.rewrite_rules = args.rewrite_rules;
    iea.inaccessible_descriptors = args.inaccessible_descriptors;
    iea.fetch_html_timeout = args.fetch_html_timeout;

    // TODO: decouple from config. In the interim I am loading from config here
    // in order to decouple import-empty from config.
    iea.filter_options = {};
    iea.filter_options.contrast_matte =
        config.read_int('contrast_default_matte');
    iea.filter_options.contrast_ratio = config.read_float('min_contrast_ratio');
    // TODO: read from config (temporarily hardcoded due to a bug)
    iea.filter_options.set_image_sizes_timeout = new Deadline(7000);
    // TODO: read from config (temporarily hardcoded due to a bug)
    iea.filter_options.set_image_dimensions_timeout = new Deadline(7000);
    iea.filter_options.table_scan_max_rows =
        config.read_int('table_scan_max_rows');

    const emphasis_max_length = config.read_int('emphasis_max_length');
    if (!isNaN(emphasis_max_length)) {
      iea.filter_options.emphasis_max_length = emphasis_max_length;
    }

    iea.filter_options.empty_frame_body_message =
        'Unable to display document because it uses HTML frames';


    return import_entry_noexcept(iea);
  });
  return Promise.all(promises);
}

// Calls import_entry and traps all errors except for assertion errors.
async function import_entry_noexcept(args) {
  let new_entry_id = 0;
  try {
    new_entry_id = await import_entry(args);
  } catch (error) {
    if (is_assert_error(error)) {
      throw error;
    } else if (error instanceof db.errors.ConstraintError) {
      // Ignore
    } else {
      // For debugging
      console.warn(error);
    }
  }
  return new_entry_id;
}

// Copy over properties from the parsed feed and appropriately update the local
// feed object with new data. Note that response url has already been appended,
// and that the local feed may already have one or more urls.
function update_model_feed_from_parsed_feed(feed, parsed_feed) {
  feed.feed_format = parsed_feed.type;
  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.published_date = parsed_feed.published_date;

  // Try to normalize the new link value and overwrite. The link value comes
  // from the raw data and we are not sure if it is valid.
  if (parsed_feed.link) {
    try {
      const link_url = new URL(parsed_feed.link);
      feed.link = link_url.href;
    } catch (error) {
      // Ignore, retain the prior link if it exists
    }
  }
}

// Throw a constraint error if the feed exists in the database. Note that this
// only checks against the tail url of the feed, so this result is unreliable
// when there are multiple urls.
async function validate_feed_is_unique(feed, conn) {
  const url = db.get_url(feed);

  const existing_feed = await db.get_resource(
      {conn: conn, mode: 'url', url: url, key_only: true});

  if (existing_feed) {
    const message = 'Already subscribed to feed with url ' + url.href;
    throw new db.errors.ConstraintError(message);
  }
}

// Convert a parsed entry into a storable entry
function parsed_entry_to_model_entry(parsed_entry) {
  const entry = {};
  entry.title = parsed_entry.title;
  entry.author = parsed_entry.author;
  entry.published_date = parsed_entry.published_date;
  entry.content = parsed_entry.content;
  entry.enclosure = parsed_entry.enclosure;

  if (parsed_entry.link) {
    try {
      const link_url = new URL(parsed_entry.link);
      db.set_url(entry, link_url);
    } catch (error) {
      // Ignore
    }
  }
  return entry;
}