'use strict';

// Dependencies:
// assert.js
// lonestar-filter.js
// responsive-image-filter.js
// debug.js
// entry.js
// favicon.js
// feed.js
// fetch.js
// html.js
// object.js
// reader-db.js
// url.js

// TODO: move comments to github


async function poll_entry(entry, reader_conn, icon_conn, feed,
  fetch_html_timeout_ms, fetch_img_timeout_ms) {

  // TODO: improve this assertion, e.g. entry_is_entry
  ASSERT(entry);

  // TODO: if reader_conn is not used locally this assertion should be
  // delegated
  ASSERT(idb_conn_is_open(reader_conn));

  // TODO: if icon_conn is not used locally this assertion should be delegated
  ASSERT(idb_conn_is_open(icon_conn));

  // TODO: improve this assertion
  ASSERT(feed);

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
    DEBUG(error);

    // If the fetch failed, then process the entry as local
    const prepared_entry = poll_entry_prepare_local_entry(entry);
    return await poll_entry_entry_prep_and_store(prepared_entry, reader_conn);
  }

  // If a redirect occurred, then check again if the entry should be polled
  if(response.redirected) {
    url_string = response.response_url;
    if(poll_entry_is_unpollable_url(url_string))
      return false;
    if(await reader_db_find_entry_by_url(reader_conn, url_string))
      return false;

    // TODO: do I also want to apply rewrite rules to the redirected?

    // If a redirect occurred and we are going to continue polling, append the
    // redirect to the entry. The url will now represent the entry
    entry_append_url(entry, url_string);
  }

  await poll_entry_entry_update_favicon(entry, icon_conn,
    feed.faviconURLString);
  const entry_content = await response.text();

  const [status, entry_document] = html_parse_from_string(entry_content);
  if(status !== STATUS_OK)
    return false;

  await poll_entry_prepare_remote_entry(entry, entry_document,
    fetch_img_timeout_ms);
  return await poll_entry_entry_prep_and_store(entry, reader_conn);
}

async function poll_entry_prepare_remote_entry(entry, doc,
  fetch_img_timeout_ms) {

  // TODO: several of these calls should be moved into poll_doc_prep

  ping_filter(doc);
  noreferrer_filter(doc);

  // This must occur before setting image dimensions
  lonestar_filter(doc);

  // This should generally occur prior to lazy_image_filter, and it should
  // definitely occur prior to setting image dimensions. Does not matter if
  // before or after resolving urls.
  response_image_filter(doc);

  // This must occur before removing sourceless images
  lazy_image_filter(doc);

  const url_string = entry_get_top_url(entry);

  base_filter(doc);

  const base_url_object = new URL(url_string);
  canonical_url_filter(doc, base_url_object);

  // This must occur after urls are resolved and after filtering tracking info
  let allowed_protocols = undefined; // defer to defaults
  await image_size_filter(doc, allowed_protocols,
    fetch_img_timeout_ms);

  poll_doc_prep(doc, url_string);

  entry.content = doc.documentElement.outerHTML.trim();
}

// @param entry {Object}
// @param icon_conn {IDBDatabase}
// @param fallback_url {String}
async function poll_entry_entry_update_favicon(entry, icon_conn, fallback_url) {
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

// TODO: the prep work should actually be a separate function decoupled from
// this function. It creates more boilerplate in the caller context but it
// seems like a better design. The caller should call prep, get a prepped
// entry object, then call reader_db_put_entry directly
async function poll_entry_entry_prep_and_store(entry, reader_conn) {
  let author_max_length, title_max_length, content_max_length;
  const sanitized_entry = entry_sanitize(entry, author_max_length,
    title_max_length, content_max_length);
  const storable_entry = object_filter_empty_props(sanitized_entry);
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  try {
    const added_entry = await reader_db_put_entry(reader_conn, storable_entry);
    return true;
  } catch(error) {
    DEBUG(entry_get_top_url(entry), error);
  }
  return false;
}

function poll_entry_prepare_local_entry(entry) {
  ASSERT(entry);

  if(!entry.content)
    return entry;

  const url_string = entry_get_top_url(entry);
  ASSERT(url_string);

  const [status, doc] = html_parse_from_string(entry.content);
  if(status !== STATUS_OK) {
    return entry;
  }

  // If status is STATUS_OK then doc should always be defined
  ASSERT(doc);

  ping_filter(doc);
  noreferrer_filter(doc);

  // TODO: this should be part of poll_doc_prep not external
  lonestar_filter(doc);

  poll_doc_prep(doc, url_string);
  const content = doc.documentElement.outerHTML.trim();
  if(content)
    entry.content = content;
  return entry;
}
