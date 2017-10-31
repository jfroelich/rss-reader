'use strict';

// import base/errors.js
// import net/fetch.js
// import net/url.js
// import poll/poll-document-filter.js
// import entry.js
// import favicon.js
// import feed.js
// import html.js
// import reader-db.js
// import reader-storage.js
// import rewrite-url.js


function poll_entry_context() {
  console.assert(this !== window);
  this.reader_conn = null;
  this.icon_conn = null;
  this.feed_favicon_url = null;
  this.fetch_html_timeout_ms = undefined;
  this.fetch_image_timeout_ms = undefined;
}

// TODO: this shouldn't be returning true/false, it should be returning status
// Switching to return status partly blocked by fetch not yielding status and
// some other todos.

// Expects to be bound to a poll_entry_context
// @param entry {Object}
async function poll_entry(entry) {
  console.assert(this instanceof poll_entry_context);
  console.assert(entry_is_entry(entry));

  // Cannot assume entry has url
  if(!entry_has_url(entry)) {
    return false;
  }

  let url = entry_get_top_url(entry);
  if(!url_is_valid(url)) {
    return false;
  }

  let rewritten_url = rewrite_url(url);
  if(rewritten_url && url !== rewritten_url) {
    console.debug('rewrite_url', url, rewritten_url);
    entry_append_url(entry, rewritten_url);
    url = rewritten_url;
  }

  if(!await poll_entry_pollable(url, this.reader_conn)) {
    return false;
  }

  const response = await poll_entry_fetch(url, this.fetch_html_timeout_ms);
  let entry_content = entry.content;
  if(response) {
    if(response.redirected) {
      if(!await poll_entry_pollable(response.response_url, this.reader_conn)) {
        return false;
      }

      entry_append_url(entry, response.response_url);
      // TODO: attempt to rewrite the redirected url as well?
      url = response.response_url;
    }

    // Use the full text of the response in place of the in-feed content
    entry_content = await response.text();
  }

  let [status, entry_document] = html_parse_from_string(entry_content);

  // Only use the document for lookup if it was fetched
  const lookup_document = response ? entry_document : undefined;
  // Ignore icon update failure, do not need to check status
  await poll_entry_update_icon.call(this, entry, lookup_document);

  // Filter the entry content
  if(entry_document) {
    status = await poll_document_filter(entry_document, url,
      this.fetch_image_timeout_ms);

    if(status !== RDR_OK) {
      return false;
    }

    entry.content = entry_document.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  status = await reader_storage_add_entry(entry, this.reader_conn);
  if(status !== RDR_OK) {
    return false;
  }

  return true;
}

async function poll_entry_fetch(url, timeout) {
  let response;
  try {
    response = await fetch_html(url, timeout);
  } catch(error) {
  }
  return response;
}

// @param entry {Object} a feed entry
// @param document {Document} optional, pre-fetched document
async function poll_entry_update_icon(entry, document) {
  console.assert(entry_is_entry(entry));
  console.assert(this instanceof poll_entry_context);

  if(document) {
    console.assert(document instanceof Document);
  }

  const query = new FaviconQuery();
  query.conn = this.icon_conn;
  query.url = new URL(entry_get_top_url(entry));
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

  entry.faviconURLString = icon_url || this.feed_favicon_url;
  return RDR_OK;
}

async function poll_entry_pollable(url, conn) {
  const url_object = new URL(url);
  const hostname = url_object.hostname;

  if(poll_entry_url_is_interstitial(url_object)) {
    console.debug('interstitial', url);
    return false;
  }

  if(poll_entry_url_is_scripted(url_object)) {
    console.debug('script-generated-content', url);
    return false;
  }

  if(poll_entry_is_paywall(hostname)) {
    console.debug('paywall', url);
    return false;
  }

  if(poll_entry_requires_cookie(hostname)) {
    console.debug('requires cookie', url);
    return false;
  }

  if(url_sniff_is_binary(url_object)) {
    console.debug('binary resource', url);
    return false;
  }

  // TODO: this should be a call to something like
  // reader_storage_contains_entry that abstracts how
  // entry comparison works

  let exists;
  try {
    exists = await reader_db_find_entry_by_url(conn, url);
  } catch(error) {
    console.warn(error);
    return false;
  }

  return !exists;
}

function poll_entry_url_is_interstitial(url) {
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}

function poll_entry_url_is_scripted(url) {
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
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
