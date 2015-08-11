// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.resolver = {};

lucu.resolver.ATTRIBUTES = new Map([
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

// TODO: build this from the map, this is an extremely obvious DRY violation
lucu.resolver.RESOLVABLES_QUERY = 'a, area, audio, blockquote, embed, ' + 
  'iframe, form, img, link, object, script, source, track, video';

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
lucu.resolver.resolveDocument = function(document, baseURL) {
  'use strict';
  var forEach = Array.prototype.forEach;

  // Remove all <BASE> elements
  var bases = document.getElementsByTagName('base');
  forEach.call(bases, lucu.resolver.removeElement);

  // Resolve all resolvable elements
  var elements = document.querySelectorAll(lucu.resolver.RESOLVABLES_QUERY);
  forEach.call(elements, lucu.resolver.resolveElement);
};

// Helper for resolveDocument
// Depends on the URI lib. Modifies the element in place.
lucu.resolver.resolveElement = function(element) {

  // NOTE: this only modifies the first attribute found. if 
  // an element has multiple URL attributes, only the first
  // is changed.

  var name = element.localName;
  var attribute = lucu.resolver.ATTRIBUTES.get(name);

  var url = (element.getAttribute(attribute) || '').trim();
  
  if(!url) {
    return;
  }

  try {
    var uri = new URI(url);
    
    // Don't try and resolve absolute URLs
    if(uri.protocol()) {
      return;
    }

    var resolved = uri.absoluteTo(baseURL).toString();

    // Overwrite the attribute's value
    element.setAttribute(attribute, resolved);

  } catch(e) {
    console.debug('resolveElement error: %s %s', e, url);
  }
};

lucu.resolver.removeElement = function(element) {
  // Check if element non-null as iteration during
  // removal can sometimes cause an issue? Although
  // thight might be overly cautious

  // TODO: this is really a generic DOM function that 
  // probably belongs in some type of general dom 
  // utilities lib
  if(element) {
    element.remove();
  }
};
