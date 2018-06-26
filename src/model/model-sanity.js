import * as html from '/src/lib/html.js';
import * as string from '/src/lib/string.js';
import * as Model from '/src/model/model.js';

// TODO: finish implementation
export function is_valid_entry(entry) {
  if (!Model.is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!Model.is_valid_entry_id(entry.id)) {
      return false;
    }
  }

  return true;
}

// TODO: finish implementation
export function is_valid_feed(feed) {
  if (!Model.is_feed(feed)) {
    return false;
  }

  if ('id' in feed && !Model.is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  const urls = feed.urls;
  if (urls && !Array.isArray(urls)) {
    return false;
  }

  return true;
}

// TODO: revert to impure version that mutates input
export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  const blank_entry = Model.create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = string.filter_control_characters(author);
    author = html.replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html.truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = string.filter_unprintable_characters(content);
    content = html.truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = string.filter_control_characters(title);
    title = html.replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html.truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}


// TODO: revert to not using options parameter
export function sanitize_feed(feed, options) {
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
