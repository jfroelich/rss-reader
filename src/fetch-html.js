// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Fetch HTML Document module
 * NOTE: this uses the responseURL as the base url
 * TODO: consider embedding iframe content
 * TODO: consider sandboxing iframes
 * TODO: resolve other types of urls: applet,audio,embed,iframe,object,
 * video, param?
 * blockquote.cite, track.src, link.href, base.href, source.src,
 * area.href, form.action, script.src
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing (e.g. remove images without src attribute?)
 * TODO: there is no need to have a module. This can all be
 * a global function (or in the lucu namespace)
 */
(function(exports) {
'use strict';

var filter = Array.prototype.filter;
var forEach = Array.prototype.forEach;

function getMimeType(request) {
  return request && request.getResponseHeader('Content-Type');
}

function isTextHTML(contentType) {
  return /text\/html/i.test(contentType);
}

var RE_RESOLVABLE_PROTOCOL = /^\s*http|https\s*:/i;

function isResolvableAnchor(anchor) {
  var href = anchor.getAttribute('href');
  if(!href) return false;
  href = href.trim();
  if(!href) return false;

  // fast case
  if(href.charAt(0) == '#') return true;
  if(/^\s*javascript\s*:/i.test(href)) return false;
  if(/^\s*tel\s*:/i.test(href)) return false;
  if(/^\s*mailto\s*:/i.test(href)) return false;
  if(/^\s*ftp\s*:/i.test(href)) return false;
  return true;
}

function resolveAnchor(baseURL, anchor) {
  var href = anchor.getAttribute('href').trim();
  try {
    var resolvedURL = URI(href).absoluteTo(baseURL).toString();
    anchor.setAttribute('href', resolvedURL);
  } catch(e) {
    console.debug('Medialize absoluteTo exception: %s %s', href, e);
  }
}

function isResolvableImage(image) {
  var src = image.getAttribute('src');
  if(!src) return false;
  src = src.trim();
  if(!src) return false;
  if(/^\s*data\s*:/i.test(src)) {
    console.debug('Cannot resolve data: image %s', src);
    return false;
  }

  return true;
}

function resolveImage(baseURL, image) {
  var src = image.getAttribute('src').trim();
  try {
    var resolvedURL = URI(src).absoluteTo(baseURL).toString();
    image.setAttribute('src', resolvedURL);
  } catch(e) {
    console.debug('Medialize absoluteTo exception: %s %s', src, e);
  }
}


function fetchHTML(url, timeout, onComplete, onError) {

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = onError;
  request.onerror = onError;
  request.onabort = onError;

  request.onload = function() {
    var mime = getMimeType(this);

    if(!isTextHTML(mime)) {
      onError({type: 'invalid-content-type', target: this, contentType: mime});
      return;
    }

    if(!this.responseXML || !this.responseXML.body) {
      onError({type: 'invalid-document', target: this});
      return;
    }

    // Resolve anchors
    var baseURL = this.responseURL;
    var anchors = this.responseXML.body.getElementsByTagName('a');
    var resolvableAnchors = filter.call(anchors, isResolvableAnchor);
    resolvableAnchors.forEach(resolveAnchor.bind(this, baseURL));
    // Resolve image src urls
    var images = this.responseXML.body.getElementsByTagName('img');
    var resolvableImages = filter.call(images, isResolvableImage);
    resolvableImages.forEach(resolveImage.bind(this, baseURL));
    // And we are done. Pass back responseURL so caller can consider
    // doing something with the post-redirect url
    onComplete(this.responseXML, this.responseURL);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}

exports.lucu = lucu || {};
exports.lucu.fetchHTML = fetchHTML;

}(this));
