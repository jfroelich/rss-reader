'use strict';

// Requires status.js
// Requires string.js
// Requires reader-db.js
// TODO: reader-db.js is a circular dependency


const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

// Returns true if the id is a valid entry id, structurally. This does not
// check if the id actually corresponds to an entry.
function entry_is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

// Returns the most last url, as a string, in the entry's url list. Throws an
// error if the entry does not have urls.
function entry_get_top_url(entry) {
  ASSERT(entry);
  ASSERT(entry.urls);
  ASSERT(entry.urls.length);
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the list if needed.
// Normalizes the url. Returns true if the url was added. Returns false if the
// normalized url already exists and therefore was not added
function entry_append_url(entry, url_string) {
  const url_object = new URL(url_string);
  const normal_url_string = url_object.href;
  if(entry.urls) {
    if(entry.urls.includes(normal_url_string))
      return false;

    entry.urls.push(normal_url_string);
  } else {
    entry.urls = [normal_url_string];
  }

  return true;
}

// Checks the initial url
function entry_has_valid_url(entry, verbose) {
  if(!entry.urls || !entry.urls.length)
    return false;
  const url_string = entry.urls[0];
  let url_object;
  try {
    url_object = new URL(url_string);
  } catch(error) {
    if(verbose)
      console.warn(error);
    return false;
  }

  if(url_object.pathname.startsWith('//'))
    return false;
  return true;
}

// Returns a new entry object where fields have been sanitized. Impure
function entry_sanitize(input_entry, author_max_len, title_max_len,
  content_max_length) {

  if(typeof author_max_len === 'undefined')
    author_max_len = 200;
  if(typeof title_max_len === 'undefined')
    title_max_len = 1000;
  if(typeof content_max_length === 'undefined')
    content_max_length = 50000;

  const output_entry = Object.assign({}, input_entry);

  if(output_entry.author) {
    let author = output_entry.author;
    author = string_filter_control_chars(author);
    author = html_replace_tags(author, '');
    author = string_condense_whitespace(author);
    author = html_truncate(author, author_max_len);
    output_entry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(output_entry.content) {
    let content = output_entry.content;
    content = html_truncate(content, content_max_length);
    output_entry.content = content;
  }

  if(output_entry.title) {
    let title = output_entry.title;
    title = string_filter_control_chars(title);
    title = html_replace_tags(title, '');
    title = string_condense_whitespace(title);
    title = html_truncate(title, title_max_len);
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

// Mark the corresponding entry as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} the entry id
async function entry_mark_read(conn, id) {
  let entry;
  try {
    entry = await reader_db.find_entry_by_id(conn, id);
  } catch(error) {
    return STATUS.ERR_DB_OP;
  }

  if(!entry || entry.readState === ENTRY_STATE_READ)
    return STATUS.ERR_DB_STATE;

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  try {
    await reader_db.put_entry(conn, entry);
  } catch(error) {
    return STATUS.ERR_DB_OP;
  }

  extension_update_badge_text();

  return STATUS.OK;
}
