// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Requires uri
function resolveAnchorElement(baseURI, anchorElement) {

  if(!baseURI)
    return;

  // Use the attribute to get the url, not the property, because
  // property access does not return the original value
  var sourceURL = (anchorElement.getAttribute('href') || '').trim();

  if(!sourceURL)
    return;

  // TODO: do not resolve certain schemes: mailto, javascript
  // calendar (caldav?), filesystem..? feed:???  This should
  // be a feature of the URI API but the URI API currently sucks
  // and is incomplete so we have to do the checks here.

  if(/^mailto:/.test(sourceURL)) {
    return;
  }

  if(/^javascript:/.test(sourceURL)) {
    return;
  }

  var sourceURI = lucu.uri.parse(sourceURL);

  // At this point we should have a resolvable URI. This is a simple
  // debugging check for learning about url resolution errors
  if(sourceURI.scheme) {
    if(sourceURI.scheme != 'http' && sourceURI.scheme != 'https') {
      console.warn('probable url resolution bug %s', sourceURL);
    }
  }

  var resolvedURL = lucu.uri.resolve(baseURI, sourceURI);

  if(resolvedURL == sourceURL)
    return;

  //console.debug('Changing anchor url from %s to %s', sourceURL, resolvedURL);

  // TODO: perhaps this function should be redesigned so that it can be
  // passed as a parameter to HTMLElement.prototype.setAttribute that was
  // bound to the element. This way it is less of a side-effect style function
  // At the same time it introduces more boilerplate into the calling context.

  anchorElement.setAttribute('href', resolvedURL);
}
