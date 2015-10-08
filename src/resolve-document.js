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
  const forEach = Array.prototype.forEach;

  // Remove all <BASE> elements
  const bases = document.getElementsByTagName('base');
  forEach.call(bases, lucu.dom.remove);

  // Resolve all resolvable elements
  const elements = document.querySelectorAll(lucu.resolver.RESOLVABLES_QUERY);
  const resolveElement = lucu.resolver.resolveElement.bind(null, baseURL);
  forEach.call(elements, resolveElement);
};

// Helper for resolveDocument
// Depends on the URI lib. Modifies the element in place.
lucu.resolver.resolveElement = function(baseURL, element) {
  'use strict';
  // NOTE: this only modifies the first attribute found. if 
  // an element has multiple URL attributes, only the first
  // is changed.

  const name = element.localName;
  const attribute = lucu.resolver.ATTRIBUTES.get(name);
  const url = (element.getAttribute(attribute) || '').trim();
  
  if(!url) {
    return;
  }

  try {
    const uri = new URI(url);
    
    // Don't try and resolve absolute URLs
    if(uri.protocol()) {
      return;
    }

    const resolved = uri.absoluteTo(baseURL).toString();

    // Overwrite the attribute's value
    element.setAttribute(attribute, resolved);

  } catch(e) {
    console.debug('resolveElement error: %s %s', e, url);
  }
};
