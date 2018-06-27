import assert from '/src/lib/assert.js';
import * as html from '/src/lib/html.js';
import * as string from '/src/lib/string.js';
import * as Model from '/src/model/model.js';

// Throws a ValidationError if the input entry has invalid properties
// TODO: finish implementation
export function validate_entry(entry) {
  // It is a programmer error to call this on an object that is not an entry
  // Validation is for validation of actual entry objects, not general values
  assert(Model.is_entry(entry));

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    vassert(Model.is_valid_entry_id(entry.id));
  }

  if (entry.dateCreated && entry.dateUpdated) {
    vassert(entry.dateUpdated >= entry.dateCreated);
  }


  // NOTE: tolerate custom properties on the object, we only care about
  // validating known properties
}

// TODO: finish implementation
export function validate_feed(feed) {
  // This should only be called on objects purporting to be feeds. It is a
  // programmer error to call this on other values.
  assert(Model.is_feed(feed));

  // Either the feed does not have an id, or it has a valid id
  vassert(feed.id === undefined || Model.is_valid_feed_id(feed.id));

  // Either the feed does not have a title or title is a string
  vassert(feed.title === undefined || typeof feed.title === 'string');

  // Eiter the feed does not have a urls property or it is an array
  vassert(feed.urls === undefined || Array.isArray(feed.urls));
}

export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  // Calling this on a non-entry value is a persistent programmer error
  assert(Model.is_entry(entry));

  if (entry.author) {
    let author = entry.author;
    author = string.filter_control_characters(author);
    author = html.replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html.truncate_html(author, author_max_length);
    entry.author = author;
  }

  if (entry.content) {
    let content = entry.content;
    content = string.filter_unprintable_characters(content);
    content = html.truncate_html(content, content_max_length);
    entry.content = content;
  }

  if (entry.title) {
    let title = entry.title;
    title = string.filter_control_characters(title);
    title = html.replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html.truncate_html(title, title_max_length);
    entry.title = title;
  }
}


// TODO: revert to not using options parameter
export function sanitize_feed(feed, options) {
  // It is a persistent programmer error to call this on a non-feed
  assert(Model.is_feed(feed));

  options = options || {};
  const title_max_len = options.title_max_len || 1024;
  const desc_max_len = options.desc_max_len || 1024 * 10;

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = string.filter_control_characters(title);
    title = html.replace_tags(title, html_tag_replacement);
    title = string.condense_whitespace(title);
    title = html.truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = string.filter_control_characters(desc);
    desc = html.replace_tags(desc, html_tag_replacement);
    desc = string.condense_whitespace(desc);
    desc = html.truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}

// This is similar to an AssertionError, but fundamentally still different. I
// distinguish between errors indicating actual programmer errors, and errors
// indicating bad data, because not all bad data errors come from programming
// error. The base assert call should only be used to assert against impossible
// cases that are only possible because of programmer error. This is to assert
// against possible cases as well as impossible cases.
function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
