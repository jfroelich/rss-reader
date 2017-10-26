'use strict';

// import base/object.js
// import base/status.js
// import http/fetch.js
// import poll/poll-document-filter.js
// import entry.js
// import favicon.js
// import feed.js
// import html.js
// import reader-db.js
// import url.js

function PollEntryDescriptor() {
  this.entry = null;
  this.reader_conn = null;
  this.icon_conn = null;
  this.feed_favicon_url = null;
  this.fetch_html_timeout_ms = undefined;
  this.fetch_image_timeout_ms = undefined;
}


// TODO: regarding the bug below, it is because this is not a composition of
// individual elements each of which has been tested. Because I have not
// bothered to write tests, and I have not quite thought of how to organize
// the functionality into smaller components. For debugging, what I would
// prefer to do is break apart the problem into smaller problems, and then
// test each component separately, and make assertions about input and
// output.


// TODO: this shouldn't be returning true/false, it should be returning status
// Switching to return status partly blocked by fetch not yielding status and
// some other todos. Need to work from the bottom up, and review which
// helper functions throw errors.
async function poll_entry(desc) {
  console.assert(typeof desc === 'object');
  console.assert(entry_is_entry(desc.entry));

  const entry = desc.entry;
  if(!entry_has_url(entry)) {
    return false;
  }

  let url = entry_get_top_url(entry);
  if(!url_is_valid(url)) {
    return false;
  }

  let rewritten_url = rewrite_url(url);
  if(rewritten_url && url !== rewritten_url) {
    console.debug('rewrote entry url', url, rewritten_url);
    entry_append_url(entry, rewritten_url);
    url = rewritten_url;
  }

  if(!await poll_entry_pollable(url, desc.reader_conn)) {
    return false;
  }

  const response = await poll_entry_fetch(url, desc.fetch_html_timeout_ms);
  if(response && response.redirected) {
    if(!await poll_entry_pollable(response.response_url, desc.reader_conn)) {
      return false;
    }

    entry_append_url(entry, response.response_url);
    url = response.response_url;

    // TODO: rewrite the redirected url?
  }

  // Initialize entry content to either the fetched text or the feed text,
  // based on whether the fetch was successful. This pulls in the body of the
  // response, which is deferred until checking if the redirect url exists.
  const entry_content = response ? await response.text() : entry.content;
  const [status, entry_document] = html_parse_from_string(entry_content);

  // Lookup the favicon
  const query = new FaviconQuery();
  query.conn = desc.icon_conn;
  query.url = new URL(url);
  query.skip_url_fetch = true;
  query.document = response ? entry_document : undefined;
  const icon_url = await favicon_lookup(query);
  entry.faviconURLString = icon_url || desc.feed_favicon_url;

  // Filter the entry content
  if(entry_document) {
    await poll_document_filter(entry_document, url,
      desc.fetch_image_timeout_ms);
    entry.content = entry_document.documentElement.outerHTML.trim();
  }

  // Store the entry
  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = object_filter_empty_props(sanitized_entry);
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  // BUG: something strange is happening with pdf urls now. I see the following
  // error message in the console, printed by the console.warn call in the
  // next try catch.
  // First off, this entry should not be in the database. So maybe the database
  // entered an unexpected state?
  // Second, I am doing multiple exists checks. How are none of them
  // matching?
  // It could be related to the rewriting switch, where I rewrite before
  // checking if exists? But url is left as is if no rewrite occurs, so the
  // initial url is still checked.
/*
DOMException: Unable to add key to index 'urls': at least one key does not
satisfy the uniqueness requirements.
["http://www.mit.edu/~jnt/Papers/J012-86-intractable.pdf"]
*/


  try {
    await reader_db_put_entry(desc.reader_conn, storable_entry);
  } catch(error) {
    console.warn(error, storable_entry.urls);
    return false;
  }

  return true;
}

async function poll_entry_fetch(url, timeout) {
  let response;
  try {
    response = await fetch_html(url, timeout);
  } catch(error) {
    // Fetch errors are non-fatal to polling an entry
  }
  return response;
}

async function poll_entry_pollable(url, conn) {
  const url_object = new URL(url);
  const hostname = url_object.hostname;

  if(poll_entry_is_interstitial(hostname)) {
    return false;
  }

  if(poll_entry_is_scripted(hostname)) {
    return false;
  }

  if(poll_entry_is_blacklisted_url(url)) {
    return false;
  }

  // BUG: this is missing PDFs for some reason
  // http://www.cse.unsw.edu.au/~hpaik/thesis/showcases/16s2/
  // http://www.mit.edu/~jnt/Papers/J012-86-intractable.pdf

  // TEST RESULT: url_sniff_is_binary on scott_brisbane.pdf returns true.
  // So this should return false. Ah. That was the bug. The inversion of the
  // condition. The previous function is is unpollable, and now this is
  // called with !is_pollable. But I simply copied this from earlier. So
  // url_sniff_is_binary works, this just was returning the opposite of what
  // I intended.

  // Followup, yes, I think this was the bug. Ran poll tests again, and now
  // this is properly catching binaries, and I am not seeing fetch accept
  // errors.

  // Lesson: fast refactoring that involves copy and paste is sometimes bad.
  // Lesson: during refactoring, be especially wary of nested conditions in a
  // function that returns a boolean result.

  // How would I avoid this in the future?
  // 1) Refactor slower.
  // 2) Use fewer layers of abstraction?
  // 3) Test driven development.
  // 4) More modularity.

  if(url_sniff_is_binary(url_object)) {
    console.debug('binary resource', url);
    return false;
  }

  if(await reader_db_find_entry_by_url(conn, url)) {
    return false;
  }
  return true;
}

function poll_entry_is_interstitial(hostname) {
  const interstitial_hosts = [
    'www.forbes.com',
    'forbes.com'
  ];

  return interstitial_hosts.includes(hostname);
}

function poll_entry_is_scripted(hostname) {
  const scripted_hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return scripted_hosts.includes(hostname);
}


// TODO: split into separate functions
function poll_entry_is_blacklisted_url(url) {
  const url_object = new URL(url);
  const hostname = url_object.hostname;

  const paywall_hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  if(paywall_hosts.includes(hostname)) {
    return true;
  }

  const cookie_hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  if(cookie_hosts.includes(hostname)) {
    return true;
  }


  return false;
}
