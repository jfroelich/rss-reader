// See license.md

'use strict';

{

function lookupFavicon(cache, url, doc, verbose, callback) {
  const log = verbose ? console : SilentConsole;
  log.log('Lookup favicon', url.toString());
  const ctx = {
    'cache': cache,
    'url': url,
    'callback': callback,
    'doc': doc,
    'conn': null,
    'entry': null,
    'log': log,
    'maxAge': cache.defaultMaxAge
  };

  cache.connect(connectOnSuccess.bind(ctx), connectOnError.bind(ctx));
}

function connectOnSuccess(event) {
  this.log.log('Connected to favicon cache');
  this.conn = event.target.result;
  if(this.doc) {
    const iconURL = searchDocument.call(this, this.doc, this.url);
    if(iconURL) {
      this.log.log('Found icon in prefetched doc', iconURL.href);
      this.cache.add(this.conn, this.url, iconURL);
      onLookupComplete.call(this, iconURL);
      return;
    }
  }

  this.cache.find(this.conn, this.url, onFindRequestURL.bind(this));
}

function connectOnError(event) {
  this.log.error(event.target.error);
  let iconURL;
  if(this.doc) {
    iconURL = searchDocument.call(this, this.doc, this.url);
  }
  onLookupComplete.call(this, iconURL);
}

function onFindRequestURL(entry) {
  if(!entry) {
    fetchDocument.call(this);
    return;
  }

  this.entry = entry;
  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.log('HIT (expired)', this.url.href);
    fetchDocument.call(this);
    return;
  }

  const iconURL = new URL(entry.iconURLString);
  onLookupComplete.call(this, iconURL);
}

function fetchDocument() {
  if('onLine' in navigator && !navigator.onLine) {
    this.log.debug('Offline');
    let iconURL;
    if(this.entry) {
      iconURL = new URL(this.entry.iconURLString);
    }
    onLookupComplete.call(this, iconURL);
    return;
  }

  this.log.log('GET', this.url.href);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.responseType = 'document';
  request.onerror = fetchDocumentOnError.bind(this);
  request.ontimeout = fetchDocumentOnTimeout.bind(this);
  request.onabort = fetchDocumentOnAbort.bind(this);
  request.onload = fetchDocumentOnSuccess.bind(this);
  request.open('GET', this.url.href, isAsync);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetchDocumentOnAbort(event) {
  this.log.error(event.type, this.url.href);
  onLookupComplete.call(this);
}

function fetchDocumentOnError(event) {
  this.log.error(event.type, this.url.href);
  if(this.entry) {
    this.cache.remove(this.conn, this.url);
  }
  lookupOriginURL.call(this);
};

function fetchDocumentOnTimeout(event) {
  this.log.debug(event.type, this.url.href);
  lookupOriginURL.call(this);
};

function fetchDocumentOnSuccess(event) {
  this.log.debug('GOT', this.url.href);
  const responseURL = new URL(event.target.responseURL);
  if(responseURL.href !== this.url.href) {
    this.log.debug('REDIRECT', this.url.href, '>', responseURL.href);
  }

  const doc = event.target.responseXML;
  if(!doc) {
    this.log.debug('Undefined document', this.url.href);
    lookupRedirectURL.call(this, responseURL);
    return;
  }

  const iconURL = searchDocument.call(this, doc, responseURL);
  if(iconURL) {
    this.log.debug('Found icon in page', this.url.href, iconURL.href);
    this.cache.add(this.conn, this.url, iconURL);
    if(responseURL.href !== this.url.href) {
      this.cache.add(this.conn, responseURL, iconURL);
    }

    onLookupComplete.call(this, iconURL);
  } else {
    this.log.debug('No icon in fetched document', this.url.href);
    lookupRedirectURL.call(this, responseURL);
  }
}

function lookupRedirectURL(redirectURL) {
  if(redirectURL && redirectURL.href !== this.url.href) {
    this.log.debug('Searching cache for redirect url', redirectURL.href);
    const onLookup = onLookupRedirectURL.bind(this, redirectURL);
    this.cache.find(this.conn, redirectURL, onLookup);
  } else {
    lookupOriginURL.call(this, redirectURL);
  }
}

function onLookupRedirectURL(redirectURL, entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non expired redirect url entry in cache',
      redirectURL.href);
    const iconURL = new URL(entry.iconURLString);
    this.cache.add(this.conn, this.url, iconURL);
    onLookupComplete.call(this, iconURL);
  } else {
    lookupOriginURL.call(this, redirectURL);
  }
}

function lookupOriginURL(redirectURL) {
  const originURL = new URL(this.url.origin);
  const originIconURL = new URL(this.url.origin + '/favicon.ico');
  if(isOriginDiff(this.url, redirectURL, originURL)) {
    this.log.debug('Searching cache for origin url', originURL.href);
    this.cache.find(this.conn, originURL,
      onLookupOriginURL.bind(this, redirectURL));
  } else {
    sendImageHeadRequest.call(this, originIconURL,
      onFetchRootIcon.bind(this, redirectURL));
  }
}

function onLookupOriginURL(redirectURL, entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non-expired origin entry in cache',
      entry.pageURLString, entry.iconURLString);
    const iconURL = new URL(entry.iconURLString);
    if(this.url.href !== this.url.origin) {
      this.cache.add(this.conn, this.url, iconURL);
    }

    if(this.url.origin !== redirectURL.href) {
      this.cache.add(this.conn, redirectURL, iconURL);
    }

    onLookupComplete.call(this, iconURL);
  } else {
    const originIconURL = new URL(this.url.origin + '/favicon.ico');
    sendImageHeadRequest.call(this, originIconURL,
      onFetchRootIcon.bind(this, redirectURL));
  }
}

function onFetchRootIcon(redirectURL, iconURLString) {
  const originURL = new URL(this.url.origin);

  if(iconURLString) {
    this.log.debug('Found icon at domain root', iconURLString);
    const iconURL = new URL(iconURLString);
    this.cache.add(this.conn, this.url, iconURL);
    if(redirectURL && redirectURL.href !== this.url.href) {
      this.cache.add(this.conn, redirectURL, iconURL);
    }
    if(isOriginDiff(this.url, redirectURL, originURL)) {
      this.cache.add(this.conn, originURL, iconURL);
    }
    onLookupComplete.call(this, iconURL);
  } else {
    this.log.debug('FULL-FAIL', this.url.href);
    this.cache.remove(this.conn, this.url);
    if(redirectURL && redirectURL.href !== this.url.href) {
      this.cache.remove(this.conn, redirectURL);
    }
    if(isOriginDiff(this.url, redirectURL, originURL)) {
      this.cache.remove(this.conn, originURL);
    }
    onLookupComplete.call(this);
  }
}

function onLookupComplete(iconURLObject) {
  if(this.conn) {
    this.log.debug('Requesting database to close');
    this.conn.close();
  }

  this.callback(iconURLObject);
}

const iconSelectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

function searchDocument(doc, baseURLObject) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    this.log.debug('Document is not html or missing <head>',
        doc.documentElement.outerHTML);
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of iconSelectors) {
    const iconURL = matchSelector.call(this, doc, selector, baseURLObject);
    if(iconURL) {
      return iconURL;
    }
  }
}

function matchSelector(ancestor, selector, baseURL) {
  const element = ancestor.querySelector(selector);
  if(!element) {
    return;
  }
  const href = (element.getAttribute('href') || '').trim();
  if(!href) {
    return;
  }
  try {
    return new URL(href, baseURL);
  } catch(error) {
    this.log.debug(error);
  }
}

function isOriginDiff(pageURL, redirectURL, originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
}

function sendImageHeadRequest(imgURL, callback) {
  const request = new XMLHttpRequest();
  const isAsync = true;
  const onResponse = onRequestImageHead.bind(this, imgURL, callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imgURL.href, isAsync);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function onRequestImageHead(imgURL, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const size = getImageSize(response);
  if(!isImageFileSizeInRange(size)) {
    callback();
    return;
  }

  const type = response.getResponseHeader('Content-Type');
  if(type && !isImageMimeType(type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

const minImageSize = 49;
const maxImageSize = 10001;

function isImageFileSizeInRange(size) {
  return size > minImageSize && size < maxImageSize;
}

function getImageSize(response) {
  const lenString = response.getResponseHeader('Content-Length');
  let lenInt = 0;
  if(lenString) {
    try {
      lenInt = parseInt(lenString, 10);
    } catch(error) {
      // console.debug(error);
    }
  }

  return lenInt;
}

function isImageMimeType(type) {
  return /^\s*image\//i.test(type);
}

this.lookupFavicon = lookupFavicon;

}
