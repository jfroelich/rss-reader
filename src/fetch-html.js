// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file



var lucu = lucu || {};

/**
 * Fetches an HTML document. Passes the document and the
 * post-redirect url to the onComplete callback.
 *
 * TODO: consider embedding iframe content
 * TODO: consider sandboxing iframes
 * TODO: resolve other types of urls: applet,audio,embed,iframe,object,
 * video, param?
 * blockquote.cite, track.src, link.href, base.href, source.src,
 * area.href, form.action, script.src
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing (e.g. remove images without src attribute?)
 */
lucu.fetchHTML = function(url, timeout, onComplete, onError) {
  'use strict';

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = onError;
  request.onerror = onError;
  request.onabort = onError;

  request.onload = function() {
    var mime = this.getResponseHeader('Content-Type');

    var RE_TYPE_TEXT_HTML = /text\/html/i;
    if(!RE_TYPE_TEXT_HTML.test(mime)) {
      onError({type: 'invalid-content-type', target: this, contentType: mime});
      return;
    }

    if(!this.responseXML || !this.responseXML.body) {
      onError({type: 'invalid-document', target: this});
      return;
    }

    var document = this.responseXML;

    // Resolve anchors
    var baseURL = this.responseURL;
    var anchors = document.body.getElementsByTagName('a');

    var filter = Array.prototype.filter;

    // Get a subset of only those anchors that we consider resolvable
    var resolvableAnchors = filter.call(anchors, function (anchor) {
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
    });

    resolvableAnchors.forEach(function (anchor) {
      var href = anchor.getAttribute('href').trim();
      try {
        var resolvedURL = URI(href).absoluteTo(baseURL).toString();
        anchor.setAttribute('href', resolvedURL);
      } catch(e) {
        console.debug('Medialize absoluteTo exception: %s %s', href, e);
      }
    });

    // Resolve image src urls
    var images = document.body.getElementsByTagName('img');

    // Get a subset of resolvable images
    var resolvableImages = filter.call(images, function (image) {
      var src = image.getAttribute('src');
      if(!src) return false;
      src = src.trim();
      if(!src) return false;
      if(/^\s*data\s*:/i.test(src)) {
        //console.debug('Cannot resolve data: image %s', src);
        return false;
      }

      return true;
    });

    resolvableImages.forEach(function (image) {
      var src = image.getAttribute('src').trim();
      try {
        var resolvedURL = URI(src).absoluteTo(baseURL).toString();
        image.setAttribute('src', resolvedURL);
      } catch(e) {
        console.debug('Medialize absoluteTo exception: %s %s', src, e);
      }
    });

    // Pass back responseURL so caller can consider
    // doing something with the post-redirect url
    onComplete(document, baseURL);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();

};
