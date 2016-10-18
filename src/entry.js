// See license.md

/*
TODO:
- maybe entry should have just single state like UNREAD_UNARCHIVED,
READ_ARCHIVED, etc
- issue with normalizing entry urs. https://hack.ether.camp/idea/path
redirects to https://hack.ether.camp/#/idea/path which normalizes to
https://hack.ether.camp/. Stripping hash screws this up.
- for urls with path containing '//', replace with '/'
-- e.g. http://us.battle.net//hearthstone/en/blog/20303037

*/

'use strict';

const ENTRY_UNREAD = 0;
const ENTRY_READ = 1;
const ENTRY_UNARCHIVED = 0;
const ENTRY_ARCHIVED = 1;

// Given an entry object, return the last url in its internal url chain.
function get_entry_url(entry) {
  if(!entry.urls.length) {
    throw new TypeError();
  }

  return entry.urls[entry.urls.length - 1];
}

// TODO: should normalization just be appended as another url to the chain,
// so that normalization is treated like a step similar to redirect/rewrite?
function add_entry_url(entry, url_str) {
  if(!entry.urls) {
    entry.urls = [];
  }

  const norm = normalize_entry_url(url_str);
  if(entry.urls.includes(norm)) {
    return false;
  }

  entry.urls.push(norm);
  return true;
}


function normalize_entry_url(url_str) {
  const url_obj = new URL(url_str);
  url_obj.hash = '';
  return url_obj.href;
}


// Returns a new entry object where fields have been sanitized
// TODO: ensure dates are not in the future, and not too old?
function sanitize_entry(input_entry) {
  const author_max_len = 200;
  const title_max_len = 1000;
  const content_max_len = 50000;

  const output_entry = Object.assign({}, input_entry);

  if(output_entry.author) {
    let author = output_entry.author;
    author = filter_control_chars(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_len);
    output_entry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling sanitize_entry. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(output_entry.content) {
    let content = output_entry.content;
    content = truncate_html(content, content_max_len);
    output_entry.content = content;
  }

  if(output_entry.title) {
    let title = output_entry.title;
    title = filter_control_chars(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len);
    output_entry.title = title;
  }

  return output_entry;
}
