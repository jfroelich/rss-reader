'use strict';

const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

function entry_get_url_string(entry) {
  if(!entry.urls.length)
    throw new TypeError('entry.urls.length is 0');
  return entry.urls[entry.urls.length - 1];
}

// Append a url to the entry's internal url list. Lazily creates the list if
// need. Also normalizes the url. Returns false if the url already exists and
// was not added
function entry_add_url_string(entry, url_string) {
  const normalizedURLObject = new URL(url_string);
  if(entry.urls) {
    if(entry.urls.includes(normalizedURLObject.href)) {
      return false;
    }
    entry.urls.push(normalizedURLObject.href);
  } else {
    entry.urls = [normalizedURLObject.href];
  }

  return true;
}

// Returns a new entry object where fields have been sanitized. Impure
function entry_sanitize(input_entry, author_max_length, title_max_length,
  content_max_length) {
  function condense_whitespace(string) {
    return string.replace(/\s{2,}/g, ' ');
  }

  if(typeof author_max_length === 'undefined')
    author_max_length = 200;
  if(typeof title_max_length === 'undefined')
    title_max_length = 1000;
  if(typeof content_max_length === 'undefined')
    content_max_length = 50000;

  const output_entry = Object.assign({}, input_entry);

  if(output_entry.author) {
    let author = output_entry.author;
    author = filter_control_chars(author);
    author = replace_html(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(output_entry.content) {
    let content = output_entry.content;
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if(output_entry.title) {
    let title = output_entry.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}

// Returns a new entry object that is in a compacted form. The new entry is a
// shallow copy of the input entry, where only certain properties are kept, and
// a couple properties are changed.
// Used by archive_entries pretty much exclusively, but because it
// requires so much knowledge of an entry's properties I think it belongs here.

function compact_entry(entry, verbose) {
  const ce = {};
  ce.dateCreated = entry.dateCreated;
  ce.dateRead = entry.dateRead;
  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  if(verbose)
    console.debug('before', sizeof(entry), 'after', sizeof(ce));
  return ce;
}
