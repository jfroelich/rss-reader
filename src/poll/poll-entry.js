'use strict';

// import base/status.js
// import http/fetch.js
// import poll/poll-document-filter.js
// import entry.js
// import favicon.js
// import feed.js
// import html.js
// import reader-db.js
// import reader-entry-add.js
// import rewrite-url.js
// import url.js

function PollEntryDescriptor() {
  this.entry = null;
  this.reader_conn = null;
  this.icon_conn = null;
  this.feed_favicon_url = null;
  this.fetch_html_timeout_ms = undefined;
  this.fetch_image_timeout_ms = undefined;
}

// TODO: this shouldn't be returning true/false, it should be returning status
// Switching to return status partly blocked by fetch not yielding status and
// some other todos. Need to work from the bottom up, and review which
// helper functions throw errors.

// This function is not 'thread-safe'. If calling poll_entry in a sychronous
// loop like a for loop, make sure to use a new and separate (isolated)
// descriptor object for each call.
async function poll_entry(desc) {
  console.assert(desc instanceof PollEntryDescriptor);
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

  let status, entry_document;

  // Initialize entry content to either the fetched text or the feed text,
  // based on whether the fetch was successful. This pulls in the body of the
  // response, which is deferred until checking if the redirect url exists.
  const entry_content = response ? await response.text() : entry.content;
  [status, entry_document] = html_parse_from_string(entry_content);

  // Only use the document for lookup if it was fetched
  const doc_for_lookup = response ? entry_document : undefined;
  // Ignore icon update failure, do not need to check status
  status = await poll_entry_update_icon(desc, doc_for_lookup);

  // Filter the entry content
  if(entry_document) {
    status = await poll_document_filter(entry_document, url,
      desc.fetch_image_timeout_ms);

    if(status !== STATUS_OK) {
      return false;
    }

    entry.content = entry_document.documentElement.outerHTML.trim();
  }

  status = await reader_entry_add(desc.entry, desc.reader_conn);
  if(status !== STATUS_OK) {
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

async function poll_entry_update_icon(desc, document) {
  console.assert(desc instanceof PollEntryDescriptor);

  const query = new FaviconQuery();
  query.conn = desc.icon_conn;
  query.url = new URL(entry_get_top_url(desc.entry));
  query.skip_url_fetch = true;
  query.document = document;

  // TODO: once favicon_lookup returns status, then no need for try/catch. Until
  // then, trap the exception to prevent this function from throwing in the
  // ordinary case.

  let icon_url;
  try {
    icon_url = await favicon_lookup(query);
  } catch(error) {
    console.warn(error);
    // lookup error is non-fatal
  }

  desc.entry.faviconURLString = icon_url || query.feed_favicon_url;
  return STATUS_OK;
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

  if(poll_entry_is_paywall(hostname)) {
    return false;
  }

  if(poll_entry_requires_cookie(hostname)) {
    return false;
  }

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
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(hostname);
}

function poll_entry_is_scripted(hostname) {
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(hostname);
}

function poll_entry_is_paywall(hostname) {
  const hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  return hosts.includes(hostname);
}

function poll_entry_requires_cookie(hostname) {
  const hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  return hosts.includes(hostname);
}
