// See license.md

'use strict';

// TODO: use fetch in fetch_doc over XMLHttpRequest

{

function lookup_favicon(cache, conn, url, doc, log, callback) {
  log = log || SilentConsole;
  log.log('Lookup favicon', url.toString());
  const ctx = {
    'cache': cache,
    'url': url,
    'callback': callback,
    'doc': doc,
    'conn': conn,
    'should_close_conn': false,
    'entry': null,
    'log': log,
    'max_age': cache.max_age
  };

  if(conn) {
    log.debug('Lookup using provided connection');
    start_lookup.call(ctx);
  } else {
    cache.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
  }
}

function start_lookup() {
  if(this.doc) {
    const icon_url = search_doc.call(this, this.doc, this.url);
    if(icon_url) {
      this.log.log('Found icon in prefetched doc', icon_url.href);
      this.cache.add(this.conn, this.url, icon_url);
      on_lookup_complete.call(this, icon_url);
      return;
    }
  }

  this.cache.find(this.conn, this.url, on_find_req_url.bind(this));
}

function connect_on_success(event) {
  this.log.log('Connected to database', this.cache.name);
  this.conn = event.target.result;
  this.should_close_conn = true;
  start_lookup.call(this);
}

function connect_on_error(event) {
  this.log.error(event.target.error);
  let icon_url;
  if(this.doc) {
    icon_url = search_doc.call(this, this.doc, this.url);
  }
  on_lookup_complete.call(this, icon_url);
}

function on_find_req_url(entry) {
  if(!entry) {
    fetch_doc.call(this);
    return;
  }

  this.entry = entry;
  if(this.cache.is_expired(entry, this.max_age)) {
    this.log.log('HIT (expired)', this.url.href);
    fetch_doc.call(this);
    return;
  }

  const icon_url = new URL(entry.iconURLString);
  on_lookup_complete.call(this, icon_url);
}

function fetch_doc() {
  if('onLine' in navigator && !navigator.onLine) {
    this.log.debug('Offline');
    let icon_url;
    if(this.entry) {
      icon_url = new URL(this.entry.iconURLString);
    }
    on_lookup_complete.call(this, icon_url);
    return;
  }

  this.log.log('GET', this.url.href);
  const is_async = true;
  const request = new XMLHttpRequest();
  request.responseType = 'document';
  request.onerror = fetch_doc_on_error.bind(this);
  request.ontimeout = fetch_doc_on_timeout.bind(this);
  request.onabort = fetch_doc_on_abort.bind(this);
  request.onload = fetch_doc_on_success.bind(this);
  request.open('GET', this.url.href, is_async);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetch_doc_on_abort(event) {
  this.log.error(event.type, this.url.href);
  on_lookup_complete.call(this);
}

function fetch_doc_on_error(event) {
  this.log.error(event.type, this.url.href);
  if(this.entry)
    this.cache.remove(this.conn, this.url);
  lookup_origin_url.call(this);
}

function fetch_doc_on_timeout(event) {
  this.log.debug(event.type, this.url.href);
  lookup_origin_url.call(this);
}

function fetch_doc_on_success(event) {
  this.log.debug('GOT', this.url.href);
  const response_url = new URL(event.target.responseURL);
  if(response_url.href !== this.url.href) {
    this.log.debug('REDIRECT', this.url.href, '>', response_url.href);
  }

  const doc = event.target.responseXML;
  if(!doc) {
    this.log.debug('Undefined document', this.url.href);
    lookup_redirect_url.call(this, response_url);
    return;
  }

  const icon_url = search_doc.call(this, doc, response_url);
  if(icon_url) {
    this.log.debug('Found icon in page', this.url.href, icon_url.href);
    this.cache.add(this.conn, this.url, icon_url);
    if(response_url.href !== this.url.href) {
      this.cache.add(this.conn, response_url, icon_url);
    }

    on_lookup_complete.call(this, icon_url);
  } else {
    this.log.debug('No icon in fetched document', this.url.href);
    lookup_redirect_url.call(this, response_url);
  }
}

function lookup_redirect_url(redirect_url) {
  if(redirect_url && redirect_url.href !== this.url.href) {
    this.log.debug('Searching cache for redirect url', redirect_url.href);
    this.cache.find(this.conn, redirect_url,
      on_lookup_redirect_url.bind(this, redirect_url));
  } else {
    lookup_origin_url.call(this, redirect_url);
  }
}

function on_lookup_redirect_url(redirect_url, entry) {
  if(entry && !this.cache.is_expired(entry, this.max_age)) {
    this.log.debug('Found non expired redirect url entry in cache',
      redirect_url.href);
    const icon_url = new URL(entry.iconURLString);
    this.cache.add(this.conn, this.url, icon_url);
    on_lookup_complete.call(this, icon_url);
  } else {
    lookup_origin_url.call(this, redirect_url);
  }
}

function lookup_origin_url(redirect_url) {
  const origin_url = new URL(this.url.origin);
  const origin_icon_url = new URL(this.url.origin + '/favicon.ico');
  if(is_origin_diff(this.url, redirect_url, origin_url)) {
    this.log.debug('Searching cache for origin url', origin_url.href);
    this.cache.find(this.conn, origin_url,
      on_lookup_origin_url.bind(this, redirect_url));
  } else {
    send_img_head_request.call(this, origin_icon_url,
      on_fetch_root_icon.bind(this, redirect_url));
  }
}

function on_lookup_origin_url(redirect_url, entry) {
  if(entry && !this.cache.is_expired(entry, this.max_age)) {
    this.log.debug('Found non-expired origin entry in cache',
      entry.pageURLString, entry.iconURLString);
    const icon_url = new URL(entry.iconURLString);
    if(this.url.href !== this.url.origin) {
      this.cache.add(this.conn, this.url, icon_url);
    }

    if(this.url.origin !== redirect_url.href) {
      this.cache.add(this.conn, redirect_url, icon_url);
    }

    on_lookup_complete.call(this, icon_url);
  } else {
    const origin_icon_url = new URL(this.url.origin + '/favicon.ico');
    send_img_head_request.call(this, origin_icon_url,
      on_fetch_root_icon.bind(this, redirect_url));
  }
}

function on_fetch_root_icon(redirect_url, icon_url_str) {
  const origin_url = new URL(this.url.origin);

  if(icon_url_str) {
    this.log.debug('Found icon at domain root', icon_url_str);
    const icon_url = new URL(icon_url_str);
    this.cache.add(this.conn, this.url, icon_url);
    if(redirect_url && redirect_url.href !== this.url.href) {
      this.cache.add(this.conn, redirect_url, icon_url);
    }
    if(is_origin_diff(this.url, redirect_url, origin_url)) {
      this.cache.add(this.conn, origin_url, icon_url);
    }
    on_lookup_complete.call(this, icon_url);
  } else {
    this.log.debug('Lookup fully failed', this.url.href);
    this.cache.remove(this.conn, this.url);
    if(redirect_url && redirect_url.href !== this.url.href) {
      this.cache.remove(this.conn, redirect_url);
    }
    if(is_origin_diff(this.url, redirect_url, origin_url)) {
      this.cache.remove(this.conn, origin_url);
    }
    on_lookup_complete.call(this);
  }
}

function on_lookup_complete(iconURLObject) {
  if(this.should_close_conn && this.conn)
    this.conn.close();
  this.callback(iconURLObject);
}

const icon_selectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

function search_doc(doc, base_url_obj) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    this.log.debug('Document is not html or missing <head>',
        doc.documentElement.nodeName);
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of icon_selectors) {
    const icon_url = match_selector.call(this, doc, selector, base_url_obj);
    if(icon_url) {
      return icon_url;
    }
  }
}

function match_selector(ancestor, selector, base_url) {
  const element = ancestor.querySelector(selector);
  if(!element)
    return;
  const href = (element.getAttribute('href') || '').trim();
  if(!href)
    return;
  try {
    return new URL(href, base_url);
  } catch(error) {
    this.log.debug(error);
  }
}

function is_origin_diff(page_url, redirect_url, origin_url) {
  return origin_url.href !== page_url.href &&
    (!redirect_url || redirect_url.href !== origin_url.href);
}

function send_img_head_request(img_url, callback) {
  const request = new XMLHttpRequest();
  const is_async = true;
  const on_response = on_img_head_response.bind(this, img_url, callback);
  request.timeout = 1000;
  request.ontimeout = on_response;
  request.onerror = on_response;
  request.onabort = on_response;
  request.onload = on_response;
  request.open('HEAD', img_url.href, is_async);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function on_img_head_response(img_url, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const size = get_response_size(response);
  if(!is_response_size_in_range(size)) {
    callback();
    return;
  }

  const type = response.getResponseHeader('Content-Type');
  if(type && !is_response_type_img(type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

const min_img_response_size = 49;
const max_img_response_size = 10001;

function is_response_size_in_range(size) {
  return size > min_img_response_size && size < max_img_response_size;
}

function get_response_size(response) {
  const len_str = response.getResponseHeader('Content-Length');
  let len_int = 0;
  if(len_str) {
    try {
      len_int = parseInt(len_str, 10);
    } catch(error) {
      // console.debug(error);
    }
  }

  return len_int;
}

function is_response_type_img(type) {
  return /^\s*image\//i.test(type);
}

this.lookup_favicon = lookup_favicon;

}
