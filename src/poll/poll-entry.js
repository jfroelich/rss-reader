'use strict';

// import base/object.js
// import html.js
// import poll/poll-document-filter.js
// import entry.js
// import feed.js
// import http/fetch.js
// import url.js
// import favicon.js
// import reader-db.js

// TODO: move comments to github

// TODO: this shouldn't be returning true/false, it should be returning status
async function poll_entry(entry, reader_conn, icon_conn, feed,
  fetch_html_timeout_ms, fetch_img_timeout_ms) {

  console.assert(entry_is_entry(entry));
  console.assert(feed_is_feed(feed));

  // Cascade properties from feed to entry
  entry.feed = feed.id;
  entry.feedTitle = feed.title;

  // Check whether the entry has a valid url. This is not an assertion.
  if(!entry_has_valid_url(entry))
    return false;

  let url_string = entry_get_top_url(entry);

  // Exclude those entries not suitable for polling based on the entry's url
  if(poll_entry_is_unpollable_url(url_string)) {
    return false;
  }

  // Check if the entry already exists in the database, using url comparison
  if(await reader_db_find_entry_by_url(reader_conn, url_string)) {
    return false;
  }

  // Try and rewrite the url and then perform the same steps again
  const rewritten_url_string = rewrite_url(url_string);
  if(rewritten_url_string && url_string !== rewritten_url_string) {
    entry_append_url(entry, rewritten_url_string);
    url_string = rewritten_url_string;
    if(poll_entry_is_unpollable_url(url_string))
      return false;
    if(await reader_db_find_entry_by_url(reader_conn, url_string))
      return false;
  }

  // Fetch the entry's full text
  let response;
  try {
    response = await fetch_html(url_string, fetch_html_timeout_ms);
  } catch(error) {
    console.warn(error);

    // If the fetch failed, then process the entry as local
    await poll_entry_prepare_local_entry(entry, fetch_img_timeout_ms);
    return await poll_entry_store_entry(entry, reader_conn);
  }

  // If a redirect occurred, then check again if the entry should be polled
  if(response.redirected) {
    url_string = response.response_url;
    if(poll_entry_is_unpollable_url(url_string))
      return false;
    if(await reader_db_find_entry_by_url(reader_conn, url_string))
      return false;

    // If a redirect occurred and we are going to continue polling, append the
    // redirect to the entry. The redirected url will now represent the entry
    entry_append_url(entry, url_string);

    // TODO: do I also want to apply rewrite rules to the redirected?
  }

  await poll_entry_update_favicon(entry, icon_conn, feed.faviconURLString);
  const entry_content = await response.text();

  const [status, entry_document] = html_parse_from_string(entry_content);
  if(status !== STATUS_OK)
    return false;

  await poll_entry_prepare_remote_entry(entry, entry_document,
    fetch_img_timeout_ms);
  return await poll_entry_store_entry(entry, reader_conn);
}

// TODO: merge with poll_entry_prepare_local_entry
async function poll_entry_prepare_remote_entry(entry, doc,
  fetch_img_timeout_ms) {
  console.assert(entry_is_entry(entry));
  const url_string = entry_get_top_url(entry);
  await poll_document_filter(doc, url_string, fetch_img_timeout_ms);
  entry.content = doc.documentElement.outerHTML.trim();
}

// TODO: merge with poll_entry_prepare_remote_entry
async function poll_entry_prepare_local_entry(entry, fetch_img_timeout_ms) {
  console.assert(entry_is_entry(entry));

  if(!entry.content) {
    return;
  }

  const url_string = entry_get_top_url(entry);
  console.assert(url_string);

  const [status, doc] = html_parse_from_string(entry.content);
  if(status !== STATUS_OK) {
    return;
  }

  await poll_document_filter(doc, url_string, fetch_img_timeout_ms);
  entry.content = doc.documentElement.outerHTML.trim();
}

// @param entry {Object}
// @param icon_conn {IDBDatabase}
// @param fallback_url {String}
async function poll_entry_update_favicon(entry, icon_conn, fallback_url) {
  const lookup_url_string = entry_get_top_url(entry);
  const lookup_url_object = new URL(lookup_url_string);
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
    max_img_size;
  const icon_url_string = await favicon_lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size);
  entry.faviconURLString = icon_url_string || fallback_url;
}

function poll_entry_is_unpollable_url(url_string) {
  const url_object = new URL(url_string);
  const hostname = url_object.hostname;

  const interstitial_hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  if(interstitial_hosts.includes(hostname))
    return true;

  const scripted_hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  if(scripted_hosts.includes(hostname))
    return true;

  const paywall_hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  if(paywall_hosts.includes(hostname))
    return true;

  const cookie_hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  if(cookie_hosts.includes(hostname))
    return true;

  if(url_sniff_is_binary(url_object))
    return true;
  return false;
}

// TODO: return status instead of bool
async function poll_entry_store_entry(entry, reader_conn) {
  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = object_filter_empty_props(sanitized_entry);
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  try {
    await reader_db_put_entry(reader_conn, storable_entry);
  } catch(error) {
    console.warn(error);
    return false;
  }
  return true;
}
