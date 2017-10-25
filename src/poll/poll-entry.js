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


// TODO: this shouldn't be returning true/false, it should be returning status
// Switching to return status partly blocked by fetch not yielding status and
// some other todos. Need to work from the bottom up, and review which
// helper functions throw errors.
async function poll_entry(entry, reader_conn, icon_conn, feed,
  fetch_html_timeout_ms, fetch_image_timeout_ms) {

  console.assert(entry_is_entry(entry));
  console.assert(feed_is_feed(feed));

  // Cascade properties from feed to entry
  // TODO: cascading properties is not a feature that poll_entry should be
  // responsible for. Move it to calling context. Next, consider the remaining
  // role of the feed parameter. If the only remaining use is to get the
  // default favicon url, then remove feed parameter and add default favicon
  // url parameter.
  entry.feed = feed.id;
  entry.feedTitle = feed.title;

  // TODO: entry_has_valid_url should maybe be inlined. First, this feels like
  // it might be the only caller. Second, it is partly redundant with
  // entry_get_top_url. Third, it feels like the wrong abstraction. I should
  // directly make a call to a function in url.js given that I have the url
  // available here. However, there is the issue of how to check if an entry
  // has any url at all. I kind of still need an entry_has_url function. Or,
  // entry_get_top_url should tolerate empty urls list and not throw in that
  // case.

  // Check whether the entry has a valid url. This is not an assertion. This
  // might be the first time the entry is validated after parsing it from
  // the feed xml.
  if(!entry_has_valid_url(entry)) {
    return false;
  }

  let url = entry_get_top_url(entry);

  // Exclude those entries not suitable for polling based on the entry's url
  if(poll_entry_is_blacklisted_url(url)) {
    return false;
  }

  // Check if the entry already exists in the database, using url comparison
  if(await reader_db_find_entry_by_url(reader_conn, url)) {
    return false;
  }

  // TODO: rewriting should probably occur prior to looking for whether the
  // entry exists. That way more urls are normalized to the same url
  // so fewer database requests are performed.

  // Try and rewrite the url and then perform the same steps again
  let rewritten_url = rewrite_url(url);
  if(rewritten_url && url !== rewritten_url) {
    entry_append_url(entry, rewritten_url);
    url = rewritten_url;

    if(poll_entry_is_blacklisted_url(url)) {
      return false;
    }

    if(await reader_db_find_entry_by_url(reader_conn, url)) {
      return false;
    }
  }

  // Fetch the entry's full text
  let response;
  try {
    response = await fetch_html(url, fetch_html_timeout_ms);
  } catch(error) {
    // Fetch errors are non-fatal to polling an entry
    console.warn(error);
  }

  if(response && response.redirected) {

    // The redirected url will now represent the entry
    url = response.response_url;

    // If a redirect occurred, then check again if the entry should be stored,
    // this time using the redirect url
    if(poll_entry_is_blacklisted_url(url)) {
      return false;
    }

    if(await reader_db_find_entry_by_url(reader_conn, url)) {
      return false;
    }

    // If a redirect occurred and we are going to continue polling, append the
    // redirect url.
    entry_append_url(entry, url);

    // TODO: apply rewrite rules to redirected url?
  }

  // Initialize entry content to either the fetched text or the feed text,
  // based on whether success was successful.
  let entry_content;
  if(response) {
    // This pulls in the body of the response, which is deferred until now,
    // after ensuring redirect url does not exist.
    entry_content = await response.text();
  } else {
    entry_content = entry.content;
  }

  // Create an HTML document from the entry content.
  const [status, entry_document] = html_parse_from_string(entry_content);

  // Set the entry's favicon (before filtering to ensure <link> appears in
  // pre-fetched document).
  const query = new FaviconQuery();
  query.conn = icon_conn;
  query.url = new URL(url);

  // Only provide the pre-fetched document to favicon_lookup if it was actually
  // fetched the remote html
  if(response) {
    query.document = entry_document;
  }

  // Regardless of whether we fetched, or failed to fetch, instruct
  // favicon_lookup not to fetch again
  query.skip_url_fetch = true;

  const icon_url = await favicon_lookup(query);
  entry.faviconURLString = icon_url || feed.faviconURLString;

  // Filter the entry content
  if(entry_document) {
    await poll_document_filter(entry_document, url, fetch_image_timeout_ms);
    entry.content = entry_document.documentElement.outerHTML.trim();
  }

  // Store the entry
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

function poll_entry_is_blacklisted_url(url_string) {
  const url_object = new URL(url_string);
  const hostname = url_object.hostname;

  const interstitial_hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  if(interstitial_hosts.includes(hostname)) {
    return true;
  }

  const scripted_hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  if(scripted_hosts.includes(hostname)) {
    return true;
  }

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

  if(url_sniff_is_binary(url_object)) {
    return true;
  }
  return false;
}
