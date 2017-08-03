// See license.md
'use strict';

{ // Begin file block scope

async function poll_entry(reader_conn, icon_conn, feed, entry,
  fetch_html_timeout_ms, fetch_img_timeout_ms, verbose) {
  entry.feed = feed.id;
  entry.feedTitle = feed.title;
  if(!is_valid_entry_url(entry))
    return false;

  let url_string = entry_get_url_string(entry);
  if(is_excluded_entry_url_string(url_string))
    return false;
  if(await db_find_entry_by_url(reader_conn, url_string))
    return false;

  const rewritten_url_string = rewrite_url_string(url_string);
  if(rewritten_url_string && url_string !== rewritten_url_string) {
    entry_add_url_string(entry, rewritten_url_string);
    url_string = rewritten_url_string;
    if(is_excluded_entry_url_string(url_string))
      return false;
    if(await db_find_entry_by_url(reader_conn, url_string))
      return false;
  }

  const response = await fetch_entry(url_string, fetch_html_timeout_ms,
    verbose);
  if(!response) {
    const prepared_entry = prepare_local_entry(entry);
    await db_prep_then_put_entry(reader_conn, prepared_entry, verbose);
    return true;
  }

  if(response.redirected) {
    url_string = response.responseURLString;
    if(is_excluded_entry_url_string(url_string))
      return false;
    else if(await db_find_entry_by_url(reader_conn, url_string))
      return false;
    else
      entry_add_url_string(entry, url_string);
  }

  await set_entry_icon(entry, icon_conn, feed.faviconURLString, verbose);
  const entry_content = await response.text();
  const entry_document = parse_html(entry_content);
  await prepare_remote_entry(entry, entry_document, fetch_img_timeout_ms);
  await db_prep_then_put_entry(reader_conn, entry, verbose);
  return true;
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

async function prepare_remote_entry(entry, doc, fetch_img_timeout_ms) {
  const url_string = entry_get_url_string(entry);
  transform_lazy_imgs(doc);
  scrubby.filter_sourceless_imgs(doc);
  scrubby.filter_invalid_anchors(doc);
  const base_url_object = new URL(url_string);
  resolve_document_urls(doc, base_url_object);
  filter_tracking_imgs(doc);
  await set_img_dimensions(doc, fetch_img_timeout_ms);
  prepare_entry_document(url_string, doc);
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

function is_excluded_entry_url_string(url_string) {
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

  if(sniff.is_probably_binary(url_object.pathname))
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
    if(verbose) {
      console.warn(error, entry_get_url_string(entry));
    }
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

function prepare_local_entry(entry, verbose) {
  if(!entry.content)
    return entry;

  const url_string = entry_get_url_string(entry);
  if(verbose)
    console.debug('Parsing html for url', url_string);

  let doc;
  try {
    doc = parse_html(entry.content);
  } catch(error) {
    if(verbose)
      console.warn(error);
    return entry;
  }

  prepare_entry_document(url_string, doc);
  const content = doc.documentElement.outerHTML.trim();
  if(content)
    entry.content = content;
  return entry;
}

function prepare_entry_document(url_string, doc) {
  prune_doc_using_host_template(url_string, doc);
  filter_boilerplate(doc);
  scrubby.scrub(doc);
  scrubby.add_no_referrer(doc);
}

function filter_tracking_imgs(doc) {
  const telemetry_hosts = [
    'ad.doubleclick.net',
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'me.effectivemeasure.net',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com',
    'stats.bbc.co.uk'
  ];

  const min_url_length = 3;// 1char hostname . 1char domain
  const images = doc.querySelectorAll('img[src]');
  for(const img_element of images) {
    let url_string = img_element.getAttribute('src');
    if(!url_string)
      continue;
    url_string = url_string.trim();
    if(!url_string)
      continue;
    else if(url_string.length < min_url_length)
      continue;
    else if(url_string.includes(' '))
      continue;
    else if(!/^https?:/i.test(url_string))
      continue;

    let url_object;
    try {
      url_object = new URL(url_string);
    } catch(error) {
      continue;
    }

    if(telemetry_hosts.includes(url_object.hostname))
      img_element.remove();
  }
}


// Applies a set of rules to a url object and returns a modified url object
// Returns undefined if no rewriting occurred
// @param url {String}
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
