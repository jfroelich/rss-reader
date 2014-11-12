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

  // Element resolution

  // Base element handling. For now, just remove. This might
  // cause issues but leaving it in causes greater issues.
  // Base has an href that is also resolvable but since we filter
  // this s not an issue
  // NOTE: what about base in head? This is wrong for now.
  var baseElements = document.body.getElementsByTagName('base');
  forEach.call(baseElements, function(base) {
    console.debug('removing %s', base.outerHTML);
    base.remove();
  });

  var RESOLVABLE_ELEMENTS = ['a', 'area', 'audio', 'blockquote', 'embed',
    'iframe', 'form', 'img', 'link', 'object', 'script', 'source',
    'track', 'video'];
  var selector = RESOLVABLE_ELEMENTS.join(',');

  // NOTE: <link> can occur in head, so this is partially incorrect

  var resolvables = document.body.querySelectorAll(selector);
  forEach.call(resolvables, function resolve(element) {
    var name = element.localName;
    var attribute = null;
    var hrefAttributes = ['a','area','link'];
    var srcAttributes = ['audio', 'embed', 'iframe', 'img', 'script',
      'source', 'track', 'video'];

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

    if(attribute == 'href') {
      if(url.charAt(0) == '#') return;
      if(/^\s*javascript\s*:/i.test(url)) return;
      if(/^\s*tel\s*:/i.test(url)) return;
      if(/^\s*mailto\s*:/i.test(url)) return;
      if(/^\s*ftp\s*:/i.test(url)) return;
    } else if(attribute == 'src') {
      if(/^\s*data\s*:/i.test(url)) return;
    }

    // How am I seeing this?
    // resolve error javascript:void(); Error: URNs do not have any generally
    // defined hierarchical components
    // TODO: I guess that I should check the other bailouts regardless of
    // attribute?

    // TODO: really, what I should be doing is use URI to parse and check if
    // absolute, and if so, get the protocol and check if http/https, and if
    // it has a protocol that is not, bail, otherwise resolve if no protocol
    // This would coincidentally resolve the issue with 'javascript' and other
    // spelling errors, and resolve the issue that my bailouts list is
    // not exhaustive (nor can it really ever be so)

    // What about this:
    // resolve error javscript:void(0) Error: URNs do not have any generally defined hierarchical components
    // I suppose there is nothing I can do about misspells?

    try {
      var resolved = URI(url).absoluteTo(baseURL).toString();
      element.setAttribute(attribute, resolved);
    } catch(e) {
      console.debug('resolve error %s %s', url, e);


    }
  });
};
