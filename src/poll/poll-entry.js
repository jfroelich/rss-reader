(function(exports) {
'use strict';

async function poll_entry(entry, reader_conn, icon_conn, feed,
  fetch_html_timeout_ms, fetch_img_timeout_ms) {

  // Cascade properties from feed to entry
  // TODO: I do not feel like it is this function's responsibility to do this.
  // I think the caller should be doing this prior to calling this function.
  // In fact, I would go as far as to say that feed should not be a parameter
  // to this function.
  entry.feed = feed.id;
  entry.feedTitle = feed.title;

  // This is the first validation of the entry from the fetched xml document.
  // The entry may be invalid. Validate it. This is not a programming error,
  // just bad data, so it would be wrong to assert.
  if(!entry_has_valid_url(entry))
    return false;

  let url_string = entry_get_top_url(entry);

  if(is_unpollable_url(url_string))
    return false;
  if(await reader_db_find_entry_by_url(reader_conn, url_string))
    return false;

  const rewritten_url_string = rewrite_url(url_string);
  if(rewritten_url_string && url_string !== rewritten_url_string) {
    entry_append_url(entry, rewritten_url_string);
    url_string = rewritten_url_string;
    if(is_unpollable_url(url_string))
      return false;
    if(await reader_db_find_entry_by_url(reader_conn, url_string))
      return false;
  }

  let response;
  try {
    response = await fetch_html(url_string, fetch_html_timeout_ms);
  } catch(error) {
    DEBUG(error);
    const prepared_entry = prepare_local_entry(entry);
    return await prep_and_store_entry(reader_conn, prepared_entry);
  }

  if(response.redirected) {
    url_string = response.responseURLString;
    if(is_unpollable_url(url_string))
      return false;
    if(await reader_db_find_entry_by_url(reader_conn, url_string))
      return false;
    entry_append_url(entry, url_string);
  }

  await entry_update_favicon(entry, icon_conn, feed.faviconURLString);
  const entry_content = await response.text();

  const [status, entry_document] = html_parse_from_string(entry_content);
  if(status !== STATUS_OK)
    return false;

  // TODO: the functions prepare_local_entry and prepare_remote_entry should
  // be merged into a single function that varies its behavior according to
  // parameters
  // TODO: prepare_remote_entry should return a new entry, not operate on an
  // entry
  await prepare_remote_entry(entry, entry_document, fetch_img_timeout_ms);
  return await prep_and_store_entry(reader_conn, entry);
}

async function prepare_remote_entry(entry, doc, fetch_img_timeout_ms) {

  // TODO: several of these calls should be moved into poll_doc_prep

  // This must occur before setting image dimensions
  lonestar_transform_document(doc);

  // This should generally occur prior to transform_lazy_images, and it should
  // definitely occur prior to setting image dimensions. Does not matter if
  // before or after resolving urls.
  responsive_transform_document(doc);

  // This must occur before removing sourceless images
  transform_lazy_images(doc);

  const url_string = entry_get_top_url(entry);
  const base_url_object = new URL(url_string);
  resolve_document_urls(doc, base_url_object);

  // This must occur after urls are resolved and after filtering tracking info
  let allowed_protocols;
  await set_img_dimensions(doc, allowed_protocols, fetch_img_timeout_ms);

  poll_doc_prep(doc, url_string);
  entry.content = doc.documentElement.outerHTML.trim();
}

// @param entry {Object}
// @param icon_conn {IDBDatabase}
// @param fallback_url {String}
async function entry_update_favicon(entry, icon_conn, fallback_url) {
  const lookup_url_string = entry_get_top_url(entry);
  const lookup_url_object = new URL(lookup_url_string);
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
    max_img_size;
  const icon_url_string = await favicon.lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size);
  entry.faviconURLString = icon_url_string || fallback_url;
}

function is_unpollable_url(url_string) {
  const url_object = new URL(url_string);
  const hostname = url_object.hostname;

  // TODO: is there a way to define these in manifest.json and then load
  // them here? Or maybe load from local storage, and have setup function
  // place the values there

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

  if(is_probably_binary_path(url_object.pathname))
    return true;
  return false;
}

// TODO: the prep work should actually be a separate function decoupled from
// this function. It creates more boilerplate in the caller context but it
// seems like a better design. The caller should call prep, get a prepped
// entry object, then call reader_db_put_entry directly
// TODO: rename, entry prefix
// TODO: entry should be first param
async function prep_and_store_entry(reader_conn, entry) {
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

function prepare_local_entry(entry) {
  if(!entry.content)
    return entry;

  const url_string = entry_get_top_url(entry);
  DEBUG('Parsing local feed entry html for url', url_string);

  let doc;
  try {
    doc = html_parse_from_string(entry.content);
  } catch(error) {
    DEBUG(error);
    return entry;
  }

  // TODO: this should be part of poll_doc_prep not external
  lonestar_transform_document(doc);

  poll_doc_prep(doc, url_string);
  const content = doc.documentElement.outerHTML.trim();
  if(content)
    entry.content = content;
  return entry;
}


exports.poll_entry = poll_entry;

}(this));
