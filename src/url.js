// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function isValidURL(url) {
  'use strict';
  if(!url) {
    return false;
  }

  var uri = null;
  try {
    uri = URI(url);
  } catch(e) {
    console.debug(e);
    return false;
  }

  if(!uri) {
    return false;
  }

  if(!uri.protocol()) {
    return false;
  }

  if(!uri.hostname()) {
    return false;
  }

  return true;
}

function getSchemelessURL(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');
  const schemeless = uri.toString().substring(2);
  return schemeless;
}

// TODO: support leading whitespace?
function isDataURI(url) {
  'use strict';
  return /^data\s*:/i.test(url);
}

function rewriteURL(url) {
  'use strict';
  const RE_GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = RE_GOOGLE_NEWS.exec(url);
  if(matches && matches.length === 2 && matches[1]) {
    const newURL = decodeURIComponent(matches[1]);
    return newURL;
  }

  return url;
}

const RESOLVABLE_ATTRIBUTES = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['link', 'href'],
  ['object', 'data'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

/**
 * TODO: support img srcset
 * TODO: support style.backgroundImage?
 * TODO: the new template tag?
 * NOTE: not supporting applet
 * NOTE: iframe.srcdoc?
 * NOTE: ignores param values with URIs
 * NOTE: could stripping the base tag could lead to invalid urls??? Should
 * the base tag, if present, be considered when resolving elements?
 * Also note that there could be multiple base tags, the logic for handling
 * it properly is all laid out in some RFC standard somewhere, and is probably
 * present in Webkit source.
 */
function resolveURLs(document, baseURL) {
  'use strict';

  const bases = document.getElementsByTagName('base');
  Array.prototype.forEach.call(bases, removeElement);

  // TODO: build this from the map
  const RESOLVABLES_QUERY = 'a, area, audio, blockquote, embed, ' + 
    'iframe, form, img, link, object, script, source, track, video';

  const elements = document.querySelectorAll(RESOLVABLES_QUERY);
  Array.prototype.forEach.call(elements, 
    resolveElementURL.bind(null, baseURL));
}

// Helper for resolveDocument
// Depends on the URI lib. Modifies the element in place.
// NOTE: this only modifies the first attribute found. if 
// an element has multiple URL attributes, only the first
// is changed.
function resolveElementURL(baseURL, element) {
  'use strict';

  const name = element.localName;
  const attribute = RESOLVABLE_ATTRIBUTES.get(name);
  const url = (element.getAttribute(attribute) || '').trim();
  
  if(!url) {
    return;
  }

  try {
    const uri = new URI(url);
    
    if(uri.protocol()) {
      return;
    }

    const resolved = uri.absoluteTo(baseURL).toString();

    // Overwrite the attribute's value
    element.setAttribute(attribute, resolved);

  } catch(e) {
    console.debug('resolveElement error: %s %s', e, url);
  }
}

/**
 * Returns a URL string pointing to the fav icon for a url. If url is
 * undefined/empty, the locally stored default fav icon url is returned
 * instead.
 *
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 * TODO: this should be using a callback, to allow for more seamless
 * transition to async service call.
 * TODO: support offline. right now this returns a remote url which
 * then causes images to not load later if offline.
 * TODO: this is should be refactored to look more like a wrapper call
 * to a service from which urls are fetched.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
 *
 * @param url {String} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {String} the url of the favicon
 */
function getFavIconURL(url) {
  'use strict';

  if(!url) {
    return '/media/rss_icon_trans.gif';
  }

  return 'http://www.google.com/s2/favicons?domain_url=' + 
    encodeURIComponent(url);
}
