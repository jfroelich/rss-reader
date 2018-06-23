import {replace_tags} from '/src/html/replace-tags.js';
import {truncate_html} from '/src/html/truncate-html.js';
import {condense_whitespace} from '/src/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lang/filter-control-characters.js';
import {filter_unprintable_characters} from '/src/lang/filter-unprintable-characters.js';
import * as Entry from '/src/model/entry.js';

// TODO: revert to impure version that mutates input
export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  const blank_entry = Entry.create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = filter_control_characters(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = filter_unprintable_characters(content);
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = filter_control_characters(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
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
    title = filter_control_characters(title);
    title = replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = filter_control_characters(desc);
    desc = replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}
