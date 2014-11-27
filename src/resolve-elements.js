// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * TODO: support img srcset
 * TODO: support style.backgroundImage?
 * TODO: the new template tag?
 * NOTE: not supporting applet
 * NOTE: iframe.srcdoc?
 * NOTE: ignores param values with URIs
 * NOTE: stripping the base tag could lead to invalid urls
 */
lucu.resolveElements = function(document, baseURL) {
  'use strict';
  var forEach = Array.prototype.forEach;

  var baseElements = document.getElementsByTagName('base');
  forEach.call(baseElements, function(base) {
    if(!base) return;
    base.remove();
  });

  var name2attribute = new Map([
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

  // TODO: build this from the map, do not specify redundantly
  var resolvables = document.querySelectorAll(
    'a, area, audio, blockquote, embed, iframe, form, img, link, '+
    'object, script, source, track, video');
  forEach.call(resolvables, function resolve(element) {
    var name = element.localName;
    var attribute = name2attribute.get(name);
    if(!attribute) return;
    var url = element.getAttribute(attribute);
    if(!url) return;
    url = url.trim();
    if(!url) return;
    try {
      var uri = new URI(url);
      // Suppress some medialize exceptions
      if(uri.protocol()) return;
      var resolved = uri.absoluteTo(baseURL).toString();
      // console.debug('resolved %s as %s', url, resolved);
      element.setAttribute(attribute, resolved);
    } catch(e) {
      console.debug('%s %s', e, url);
    }
  });
};
