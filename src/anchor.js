// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// Requires lucu.uri
lucu.anchor = {};

lucu.anchor.resolve = function(baseURI, anchorElement) {

  if(!baseURI)
    return;

  // Use the attribute to get the url, not the property, because
  // property access returns a modified value
  var sourceURL = anchorElement.getAttribute('href');
  if(!sourceURL) {
    return;
  }

  // TODO: does getAttribute implicitly trim the value for us ever?
  // Or does the behavior vary by agent?
  sourceURL = sourceURL.trim();
  if(!sourceURL) {
    return;
  }

  // TODO: do not resolve certain schemes: mailto, javascript
  // calendar (caldav?), filesystem..? feed:???  This should
  // be a feature of the URI API but the URI API currently sucks
  // and is incomplete so we have to do the checks here.

  // TODO: these checks are extremely incomplete. It may not even
  // be feasible. Maybe we should just check if is either http or
  // https only, and if so, only resolve those, otherwise consider
  // it to not be resolvable?

  // The problem is that in order to do that, we need to get the
  // 'protocol' part of the URL in the first place. Because without a
  // protocol it is a relative url, which we want to allow. If it
  // has a protocol, then only allow if http(s)?

  // TODO: is ':' part of regex syntax?

  if(/^\s*tel:/.test(sourceURL)) {
    return;
  }

  if(/^\s*mailto:/i.test(sourceURL)) {
    return;
  }

  // Allow for leading whitespace. Otherwise this seems to miss
  // some javascript: urls
  // For example I am seeing this in the log:
  // probable url resolution bug javacsript:void(0)
  // actually, note in the above examle, it is a misspell. So what should
  // we be doing in this edge case?
  // another misspell: javscript:void(0)
  if(/^\s*javascript:/i.test(sourceURL)) {
    return;
  }

  // TODO: is '-' allowed here or is it part of regex syntax?
  if(/^\s*github-windows:/i.test(sourceURL)) {
    return;
  }

  if(/^\s*whatsapp:/i.test(sourceURL)) {
    return;
  }

  if(/^\s*itpc:/i.test(sourceURL)) {
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
};
