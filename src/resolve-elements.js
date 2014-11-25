// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.resolveElements = function(document, baseURL) {
  'use strict';

  // TODO: support img srcset
  // TODO: support style.backgroundImage?
  // the new template tag?

  // NOTE: not supporting applet
  // NOTE: iframe.srcdoc?
  // NOTE: ignores param values with URIs

  var forEach = Array.prototype.forEach;

  // Strip base tags
  var baseElements = document.documentElement.getElementsByTagName('base');
  forEach.call(baseElements, function(base) {
    if(!base) return;
    console.debug('removing %s', base.outerHTML);
    base.remove();
  });

  var hrefAttributes = ['a','area','link'];
  var srcAttributes = ['audio', 'embed', 'iframe', 'img', 'script',
    'source', 'track', 'video'];
  var resolvables = document.documentElement.querySelectorAll(
    'a, area, audio, blockquote, embed, iframe, form, img, link, '+
    'object, script, source, track, video');
  forEach.call(resolvables, function resolve(element) {
    var name = element.localName;
    var attribute = null;

    if(hrefAttributes.indexOf(name) != -1) {
      attribute = 'href';
    } else if(srcAttributes.indexOf(name) != -1) {
      attribute = 'src';
    } else if(name == 'form') {
      attribute = 'action';
    } else if(name == 'blockquote') {
      attribute = 'cite';
    } else if(name == 'object') {
      // NOTE: this could be wrong, never tested
      attribute = 'data';
    }

    if(!attribute) return;

    var url = element.getAttribute(attribute);
    if(!url) return;
    url = url.trim();
    if(!url) return;

    // TODO: use URI.js to parse the relative and get the
    // protocol. Only resolve if no protocol. This avoids
    // resolving URNs (e.g. data/ftp/etc) and avoids
    // spelling errors
    if(attribute == 'href' || attribute == 'action') {
      if(/^\s*javascript\s*:/i.test(url)) return;
      if(/^\s*tel\s*:/i.test(url)) return;
      if(/^\s*mailto\s*:/i.test(url)) return;
      if(/^\s*ftp\s*:/i.test(url)) return;
    } else if(attribute == 'src') {
      if(/^\s*data\s*:/i.test(url)) return;
      if(/^\s*javascript\s*:/i.test(url)) return;
    }

    try {
      var resolved = URI(url).absoluteTo(baseURL).toString();
      element.setAttribute(attribute, resolved);
    } catch(e) {
      console.debug('resolve error %s %s', element.outerHTML, e);
    }
  });
};
