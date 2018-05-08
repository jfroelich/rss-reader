import {create_feed, is_feed, is_valid_feed_id} from '/src/feed-store/feed.js';
import {html_truncate} from '/src/lib/html-truncate.js';
import {html_replace_tags} from '/src/lib/html.js';
import {list_peek} from '/src/lib/list.js';
import {filter_empty_properties} from '/src/lib/object.js';
import {condense_whitespace, filter_control_characters} from '/src/lib/string.js';

// TODO: create modules for sanitize and validate, require caller to explicitly
// call those functions as additional optional boilerplate, and then deprecate
// the options.sanitize and options.validate arguments here. Also do a similar
// pattern for entries. Having separate sanitize and validate functions fits
// better with the one-function-per-file method of organization, is more
// readily testable, less opaque, and is a better use of parameters. See also
// note about this in the write-entry doc (or maybe its write-feed).

// Creates or updates the given feed in storage
export function write_feed(feed, options = {}) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter type ' + feed);
  }

  const is_update = 'id' in feed;
  const prefix = is_update ? 'updating' : 'creating';
  this.console.debug(
      '%s: %s feed', write_feed.name, prefix, list_peek(feed.urls));

  // TODO: if we are always going to clone and this is sole caller of
  // sanitize_feed just do the clone here in both cases and do not clone in
  // sanitize_feed. Unless I make sanitize-feed its own public method again
  let clone;
  if (options.sanitize) {
    clone = filter_empty_properties(sanitize_feed(feed, options));
  } else {
    clone = Object.assign(create_feed(), feed);
  }

  return new Promise(executor.bind(this, is_update, clone, options));
}

function executor(is_update, feed, options, resolve, reject) {
  if (options.validate && !is_valid_feed(feed)) {
    const error = new Error('Invalid feed ' + JSON.stringify(feed));
    reject(error);
    return;
  }

  // is-valid-feed just checks feed.urls type, but all stored feeds must
  // have at least one url.
  // TODO: add a check that feed.urls is not empty


  if (is_update) {
    if (options.set_date_updated) {
      feed.dateUpdated = new Date();
    }
  } else {
    feed.active = true;
    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, is_update, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);

  if (!is_update) {
    request.onsuccess = _ => feed.id = request.result;
  }
}

function txn_oncomplete(is_update, feed, callback, event) {
  const message = {type: 'feed-written', id: feed.id, create: !is_update};
  this.console.debug('%s: %o', write_feed.name, message);
  this.channel.postMessage(message);
  callback(feed);
}

// TODO: finish all checks
function is_valid_feed(feed) {
  if ('id' in feed && !is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  if ('urls' in feed && !Array.isArray(feed.urls)) {
    return false;
  }

  return true;
}

function sanitize_feed(feed, options) {
  let title_max_length = options.title_max_length,
      description_max_length = options.description_max_length;

  if (typeof title_max_length === 'undefined') {
    title_max_length = 1024;
  }

  if (typeof description_max_length === 'undefined') {
    description_max_length = 1024 * 10;
  }

  const blank_feed = create_feed();
  const output_feed = Object.assign(blank_feed, feed);
  const html_tag_replacement = '';
  const suffix = '';

  if (output_feed.title) {
    let title = output_feed.title;
    title = filter_control_characters(title);
    title = html_replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = filter_control_characters(desc);
    desc = html_replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = html_truncate(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}
