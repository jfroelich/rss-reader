'use strict';

{ // Begin file block scope

async function poll_entry(reader_conn, icon_conn, feed, entry,
  fetch_html_timeout_ms, fetch_img_timeout_ms, verbose) {
  entry.feed = feed.id;
  entry.feedTitle = feed.title;
  if(!is_valid_entry_url(entry))
    return false;

  let url_string = entry_get_url_string(entry);
  if(is_unpollable_entry(url_string))
    return false;
  if(await db_find_entry_by_url(reader_conn, url_string))
    return false;

  const rewritten_url_string = rewrite_url_string(url_string);
  if(rewritten_url_string && url_string !== rewritten_url_string) {
    entry_add_url_string(entry, rewritten_url_string);
    url_string = rewritten_url_string;
    if(is_unpollable_entry(url_string))
      return false;
    if(await db_find_entry_by_url(reader_conn, url_string))
      return false;
  }

  const response = await fetch_entry(url_string, fetch_html_timeout_ms,
    verbose);
  if(!response) {
    const prepared_entry = prepare_local_entry(entry);
    const put_result = await db_prep_then_put_entry(reader_conn, prepared_entry,
      verbose);
    return put_result;
  }

  if(response.redirected) {
    url_string = response.responseURLString;
    if(is_unpollable_entry(url_string))
      return false;
    else if(await db_find_entry_by_url(reader_conn, url_string))
      return false;
    else
      entry_add_url_string(entry, url_string);
  }

  await set_entry_icon(entry, icon_conn, feed.faviconURLString, verbose);
  const entry_content = await response.text();
  const entry_document = parse_html(entry_content);

  // TODO: the functions prepare_local_entry and prepare_remote_entry should
  // be merged into a single function that varies its behavior according to
  // parameters
  await prepare_remote_entry(entry, entry_document, fetch_img_timeout_ms,
    verbose);
  const put_result = await db_prep_then_put_entry(reader_conn, entry, verbose);
  return put_result;
}

async function fetch_entry(url_string, fetch_html_timeout_ms, verbose) {
  try {
    return await fetch_html(url_string, fetch_html_timeout_ms);
  } catch(error) {
    if(verbose)
      console.warn(error);
  }
}

function db_find_entry_by_url(conn, url_string) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

async function prepare_remote_entry(entry, doc, fetch_img_timeout_ms, verbose) {

  // This must occur before setting image dimensions
  transform_telemetry_elements(doc, verbose);

  // This should generally occur prior to transform_lazy_imgs, and it should
  // definitely occur prior to setting image dimensions. Does not matter if
  // before or after resolving urls.
  transform_responsive_images(doc);

  // This must occur before removing sourceless images
  transform_lazy_imgs(doc);

  const url_string = entry_get_url_string(entry);
  const base_url_object = new URL(url_string);
  resolve_document_urls(doc, base_url_object);

  // This must occur after urls are resolved and after filtering tracking info
  let allowed_protocols;
  await set_img_dimensions(doc, allowed_protocols, fetch_img_timeout_ms);

  prepare_entry_document(url_string, doc, verbose);
  entry.content = doc.documentElement.outerHTML.trim();
}

async function set_entry_icon(entry, icon_conn, fallback_url_string, verbose) {
  const lookup_url_string = entry_get_url_string(entry);
  const lookup_url_object = new URL(lookup_url_string);
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
    max_img_size;
  const icon_url_string = await favicon_lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size, verbose);
  entry.faviconURLString = icon_url_string || fallback_url_string;
}

function is_valid_entry_url(entry, verbose) {
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

function is_unpollable_entry(url_string) {
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

  if(is_probably_binary_path(url_object.pathname))
    return true;
  return false;
}

function db_put_entry(conn, entry) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

// TODO: the prep work should actually be a separate function decoupled from
// this function. It creates more boilerplate in the caller context but it
// seems like a better design.

async function db_prep_then_put_entry(reader_conn, entry, verbose) {
  let author_max_length, title_max_length, content_max_length;
  const sanitized_entry = entry_sanitize(entry, author_max_length,
    title_max_length, content_max_length);
  const storable_entry = filter_empty_props(sanitized_entry);
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  try {
    const added_entry = await db_put_entry(reader_conn, storable_entry);
    return true;
  } catch(error) {
    if(verbose)
      console.warn(entry_get_url_string(entry), error);
  }
  return false;
}

function parse_html(html) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const parser_error_element = document.querySelector('parsererror');
  if(parser_error_element)
    throw new Error(parser_error_element.textContent);
  return document;
}

// TODO: is this even in use?
function prepare_local_entry(entry, verbose) {
  if(!entry.content)
    return entry;

  const url_string = entry_get_url_string(entry);
  if(verbose)
    console.debug('Parsing local feed entry html for url', url_string);

  let doc;
  try {
    doc = parse_html(entry.content);
  } catch(error) {
    if(verbose)
      console.warn(error);
    return entry;
  }

  transform_telemetry_elements(doc, verbose);
  prepare_entry_document(url_string, doc, verbose);
  const content = doc.documentElement.outerHTML.trim();
  if(content)
    entry.content = content;
  return entry;
}


// TODO: this should be a call to a function defined in a separate file that
// represents a module for document processing

function prepare_entry_document(url_string, doc, verbose) {
  ensure_document_has_body(doc);
  transform_framed_document(doc, verbose);

  prune_doc_using_host_template(url_string, doc, verbose);
  filter_boilerplate(doc);
  secure_html_document(doc);
  sanitize_html_document(doc, verbose);

  // Because we are stripping attributes, there is no need to keep them when
  // condensing.
  const copy_attrs_on_rename = false;
  // How many rows to check when unwrapping single column tables
  const row_scan_limit = 20;
  html_shrink(doc, copy_attrs_on_rename, row_scan_limit);

  // Filter element attributes last because it is so slow and is sped up by
  // processing fewer elements.
  const attribute_whitelist = {
    'a': ['href', 'name', 'title', 'rel'],
    'iframe': ['src'],
    'source': ['media', 'sizes', 'srcset', 'src', 'type'],
    'img': ['src', 'alt', 'title', 'srcset']
  };

  remove_element_attributes(doc, attribute_whitelist);
}

function ensure_document_has_body(doc) {
  if(doc.body)
    return;
  const body_element = doc.createElement('body');
  const text_node = doc.createTextNode('Error empty document (no body found)');
  body_element.appendChild(text_node);
  doc.documentElement.appendChild(body_element);
}

// TODO: this belongs in a separate file and should be more customizable
// Applies a set of rules to a url object and returns a modified url object
// Returns undefined if no rewriting occurred
// @returns {String}
function rewrite_url_string(url_string) {
  const url_object = new URL(url_string);
  if(url_object.hostname === 'news.google.com' &&
    url_object.pathname === '/news/url') {
    return url_object.searchParams.get('url');
  } else if(url_object.hostname === 'techcrunch.com' &&
    url_object.searchParams.has('ncid')) {
    url_object.searchParams.delete('ncid');
    return url_object.href;
  }
}

// TODO: make this into a doc transform
// TODO: this belongs ina separate file
// TODO: host_selector_map should be a parameter to this function so that
// configuration is defined externally so that it can be changed without
// needing to modify its internals (open-closed principle)
function prune_doc_using_host_template(url_string, doc, verbose) {
  const host_selector_map = {};
  host_selector_map['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  host_selector_map['theweek.com'] = ['div#head-wrap'];
  host_selector_map['www.usnews.com'] = ['header.header'];

  const hostname = get_url_hostname(url_string);
  if(!hostname)
    return;

  const selectors = host_selector_map[hostname];
  if(!selectors)
    return;

  if(verbose)
    console.debug('Template pruning', url_string);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements)
    element.remove();
}

function get_url_hostname(url_string) {
  let url_object;
  try {
    url_object = new URL(url_string);
    return url_object.hostname;
  } catch(error) {
  }
}

this.poll_entry = poll_entry;

} // End file block scope
