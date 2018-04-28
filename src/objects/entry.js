import {html_truncate} from '/src/lib/html-truncate.js';
import {html_replace_tags} from '/src/lib/html.js';
import * as string from '/src/lib/string.js';

export const ENTRY_MAGIC = 0xdeadbeef;
export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function entry_is_valid(entry) {
  // Type check (basically check the magic prop)
  if (!is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!entry_id_is_valid(entry.id)) {
      console.debug('Invalid entry id', entry.id);
      return false;
    }
  }

  return true;
}

export function entry_sanitize(
    input_entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  const blank_entry = create_entry_object();
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

export function entry_append_url(entry, url) {
  if (!is_entry(entry)) {
    throw new TypeError('Invalid entry parameter ' + entry);
  }

  // NOTE: use duck typing over instanceof
  if (!url.href) {
    throw new TypeError('Invalid url parameter ' + url);
  }

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
// TODO: rename to `is_valid_entry_id`
export function entry_id_is_valid(value) {
  return Number.isInteger(value) && value > 0;
}

// Return true if the first parameter looks like an entry object
export function is_entry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function create_entry_object() {
  return {magic: ENTRY_MAGIC};
}
