// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.image = {};

/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 *
 * TODO: does this function belong somewhere else, like in
 * lucu.element? now that I think about it more, this is
 * actually really specific to calamine only and does not
 * belong here. Move this to calamine/something.js
 */
lucu.image.getArea = function(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(element.width && element.height) {
    var area = element.width * element.height;

    // TODO: this clamping really should be done in the caller
    // and not here.

    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }

  return 0;
};

/**
 * Mutates an image element in place by changing its src property
 * to be a resolved url, and then returns the image element.
 *
 * NOTE: requires isDataURL from uri.js
 */
lucu.image.resolve = function(baseURI, imageElement) {

  if(!baseURI) {
    return imageElement;
  }

  var sourceURL = (imageElement.getAttribute('src') || '').trim();

  // No source, so not resolvable
  if(!sourceURL) {
    return imageElement;
  }

  // this should not be resolving data: urls. Test and
  // exit early here. In at least one calling context,
  // augmentImages in http.js, it is not bothering to pre-filter
  // data: uri images before calling this function, so the
  // test has to be done here. i think it is better to do it here
  // than require the caller to avoid calling this on uri because
  // this does the attribute empty check.
  // note: in reality the URI module should be able to handle
  // this edge case and seamlessly work (calls to resolve would
  // be no ops). But the current URI module implementation is
  // shite so we have to check.

  if(lucu.uri.isDataURL(sourceURL)) {
    // console.debug('encountered data: url %s', sourceURL);
    return imageElement;
  }

  // NOTE: seeing GET resource://.....image.png errors in log.

  // TODO: I guess these should not be resolved either? Need to
  // learn more about resource URLs

  if(/^resource:/.test(sourceURL)) {
    console.debug('encountered resource: url %s', sourceURL);
    return imageElement;
  }

  var sourceURI = lucu.uri.parse(sourceURL);

  if(!sourceURI) {
    return imageElement;
  }

  // NOTE: this is not working correctly sometimes when resolving relative URLs
  // For example: GET http://example.compath/path.gif is missing leading slash

  // NOTE: resolveURI currently returns a string. In the future it should
  // return a URL, but that is not how it works right now, so we do not have
  // to convert the uri to a string explicitly here.
  var resolvedURL = lucu.uri.resolve(baseURI, sourceURI);

  if(resolvedURL == sourceURL) {
    // Resolving had no effect
    return imageElement;
  }

  imageElement.setAttribute('src', resolvedURL);

  return imageElement;
};
