// See license.md
'use strict';

{ // Begin file block scope

async function pollEntry(readerConn, iconConn, feed, entry, options) {
  entry.feed = feed.id;
  entry.feedTitle = feed.title;

  if(!isValidEntryURL(entry)) {
    return false;
  }

  let urlString = getEntryURLString(entry);
  if(shouldExcludeEntryBasedOnURL(urlString)) {
    return false;
  }

  if(await findEntryByURLInDb(readerConn, urlString)) {
    return false;
  }

  const rewrittenURLString = rewriteURLString(urlString);
  if(rewrittenURLString && urlString !== rewrittenURLString) {
    addEntryURLString(entry, rewrittenURLString);
    urlString = rewrittenURLString;
    if(shouldExcludeEntryBasedOnURL(urlString)) {
      return false;
    }

    if(await findEntryByURLInDb(readerConn, urlString)) {
      return false;
    }
  }

  const response = await fetchEntry(urlString, options);
  if(!response) {
    await putEntry(readerConn, prepareLocalEntry(entry), options.verbose);
    return true;
  }

  if(response.redirected) {
    urlString = response.responseURLString;
    if(shouldExcludeEntryBasedOnURL(urlString)) {
      return false;
    } else if(await findEntryByURLInDb(readerConn, urlString)) {
      return false;
    } else {
      addEntryURLString(entry, urlString);
    }
  }

  await setEntryIcon(entry, iconConn, feed.faviconURLString);
  const entryContentString = await response.text();
  const entryContentDocument = parseHTML(entryContentString);
  await prepareRemoteEntry(entry, entryContentDocument, options);
  await putEntry(readerConn, entry, options.verbose);
  return true;
}

this.pollEntry = pollEntry;

async function fetchEntry(urlString, options) {
  try {
    return await fetchHTML(urlString, options.fetchHTMLTimeoutMillis);
  } catch(error) {
    if(options.verbose) {
      console.warn(error);
    }
  }
}

function findEntryByURLInDb(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function prepareRemoteEntry(entry, documentObject, options) {
  const urlString = getEntryURLString(entry);
  transformLazyImages(documentObject);
  scrubby.filterSourcelessImages(documentObject);
  scrubby.filterInvalidAnchors(documentObject);
  const baseURLObject = new URL(urlString);
  resolveDocumentURLs(documentObject, baseURLObject);
  filterTrackingImages(documentObject);
  await setImageDimensions(documentObject, options.fetchImageTimeoutMillis);
  prepareEntryDocument(urlString, documentObject);
  entry.content = documentObject.documentElement.outerHTML.trim();
}

async function setEntryIcon(entry, iconConn, fallbackURLString) {
  const lookupURLString = getEntryURLString(entry);
  const lookupURLObject = new URL(lookupURLString);
  const iconURLString = await favicon.lookup(iconConn, lookupURLObject);
  entry.faviconURLString = iconURLString || fallbackURLString;
}

function isValidEntryURL(entry, verbose) {
  if(!entry.urls || !entry.urls.length) {
    return false;
  }

  const urlString = entry.urls[0];
  let urlObject;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }

    return false;
  }

  if(urlObject.pathname.startsWith('//')) {
    return false;
  }

  return true;
}

function shouldExcludeEntryBasedOnURL(urlString) {
  const urlObject = new URL(urlString);
  const hostname = urlObject.hostname;

  const interstitialHosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  if(interstitialHosts.includes(hostname)) {
    return true;
  }

  const scriptedHosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  if(scriptedHosts.includes(hostname)) {
    return true;
  }

  const paywallHosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  if(paywallHosts.includes(hostname)) {
    return true;
  }

  const cookieHosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  if(cookieHosts.includes(hostname)) {
    return true;
  }

  if(sniff.isProbablyBinary(urlObject.pathname)) {
    return true;
  }

  return false;
}

function putEntryInDb(conn, entry) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putEntry(readerConn, entry, verbose) {
  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProperties(sanitized);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  try {
    let addedEntry = await putEntryInDb(readerConn, storable);
    return true;
  } catch(error) {
    if(verbose) {
      console.warn(error, getEntryURLString(entry));
    }
  }
  return false;
}

function parseHTML(htmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, 'text/html');
  const parserErrorElement = document.querySelector('parsererror');
  if(parserErrorElement) {
    throw new Error(parserErrorElement.textContent);
  }
  return document;
}

function prepareLocalEntry(entry, verbose) {
  if(!entry.content) {
    return entry;
  }

  let documentObject;
  try {
    documentObject = parseHTML(entry.content);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
    return entry;
  }

  const urlString = getEntryURLString(entry);
  prepareEntryDocument(urlString, documentObject);
  const content = documentObject.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }
  return entry;
}

function prepareEntryDocument(urlString, documentObject) {
  pruneWithTemplate(urlString, documentObject);
  filterBoilerplate(documentObject);
  scrubby.scrub(documentObject);
  scrubby.addNoReferrer(documentObject);
}

function filterTrackingImages(documentObject) {
  const telemetryHosts = [
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

  const minValidURLLength = 3;// 1char hostname . 1char domain
  const images = documentObject.querySelectorAll('img[src]');
  for(let imageElement of images) {
    let urlString = imageElement.getAttribute('src');
    if(!urlString) {
      continue;
    }

    urlString = urlString.trim();
    if(!urlString) {
      continue;
    } else if(urlString.length < minValidURLLength) {
      continue;
    } else if(urlString.includes(' ')) {
      continue;
    } else if(!/^https?:/i.test(urlString)) {
      continue;
    }

    let urlObject;
    try {
      urlObject = new URL(urlString);
    } catch(error) {
      continue;
    }

    if(telemetryHosts.includes(urlObject.hostname)) {
      imageElement.remove();
    }
  }
}


// Applies a set of rules to a url object and returns a modified url object
// Returns undefined if no rewriting occurred
// @param url {String}
// @returns {String}
function rewriteURLString(urlString) {
  const urlObject = new URL(urlString);
  if(urlObject.hostname === 'news.google.com' &&
    urlObject.pathname === '/news/url') {
    return urlObject.searchParams.get('url');
  } else if(urlObject.hostname === 'techcrunch.com' &&
    urlObject.searchParams.has('ncid')) {
    urlObject.searchParams.delete('ncid');
    return urlObject.href;
  }
}

function pruneWithTemplate(urlString, documentObject, verbose) {
  const templateHostMap = {};
  templateHostMap['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  templateHostMap['theweek.com'] = ['div#head-wrap'];
  templateHostMap['www.usnews.com'] = ['header.header'];

  const hostname = getURLHostname(urlString);
  if(!hostname) {
    return;
  }

  const selectors = templateHostMap[hostname];
  if(!selectors) {
    return;
  }

  if(verbose) {
    console.debug('Template pruning', urlString);
  }

  const selector = selectors.join(',');
  const elements = documentObject.querySelectorAll(selector);
  for(let element of elements) {
    element.remove();
  }
}

function getURLHostname(urlString) {
  let urlObject;
  try {
    urlObject = new URL(urlString);
    return urlObject.hostname;
  } catch(error) {

  }
}

} // End file block scope
