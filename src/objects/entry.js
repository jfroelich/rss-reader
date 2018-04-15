import {html_truncate} from '/src/lib/html-truncate/html-truncate.js';
import {html_replace_tags} from '/src/lib/html/html.js';
import * as string from '/src/lib/string/string.js';

export const ENTRY_MAGIC = 0xdeadbeef;
export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

// TODO: implement
export function entry_is_valid(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  // Check required properties? This function is specifically validation for
  // storage, so maybe I should have constraints like the urls list must have
  // at least one entry.

  // TODO: for each entry property, ensure it is either undefined/null or the
  // proper type

  // TODO: maybe ensure dates are not in the future contain NaN or things like
  // that.

  return true;
}

export function entry_sanitize(
    input_entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  // Create a shallow clone of the entry. This is partly the source of impurity.
  // Here shallow refers to the fact that several of the properties are objects
  // where the reference to the object is copied, instead of copying the entire
  // value as a new object. Which basically means the new properties point to
  // the old properties. Which basically means to be careful about doing things
  // like modifying the urls property of the input entry after the sanitize
  // call, because it will implicitly cause spooky-action-at-a-distance and
  // modify the output entry object too. I've chosen the shallow copy because it
  // is generally faster and I assume I can always be careful
  const blank_entry = entry_create();
  const output_entry = Object.assign(blank_entry, input_entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = string.filter_control_characters(author);
    author = html_replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html_truncate(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = string.filter_unprintable_characters(content);
    content = html_truncate(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added
export function entry_append_url(entry, url) {
  assert(is_entry(entry));
  assert(url instanceof URL);

  const normal_url_string = url.href;
  if (entry.urls) {
    if (entry.urls.includes(normal_url_string)) {
      return false;
    }

    entry.urls.push(normal_url_string);
  } else {
    entry.urls = [normal_url_string];
  }

  return true;
}

// Return true if the first parameter looks like an entry id
export function entry_is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Return true if the first parameter looks like an entry object
export function is_entry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function entry_create() {
  return {magic: ENTRY_MAGIC};
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}

// Reformat a parsed entry as a storable entry
export function coerce_entry(parsed_entry) {
  const blank_entry = entry_create();
  const storable_entry = Object.assign(blank_entry, parsed_entry);

  delete storable_entry.link;
  if (parsed_entry.link) {
    try {
      entry_append_url(storable_entry, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return storable_entry;
}
