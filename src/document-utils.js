// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Document utility functions
class DocumentUtils {

  // Private helper
  static _remove(element) {
  	element.remove();
  }

  // Resolves all appropriate URLs in the document and removes 
  // any base tag elements
  // TODO: support img srcset
  // TODO: support style.backgroundImage?
  // TODO: the new template tag?
  // NOTE: not supporting applet
  // NOTE: iframe.srcdoc?
  // NOTE: ignores param values with URIs
  // NOTE: could stripping the base tag could lead to invalid urls??? 
  // Should the base tag, if present, be considered when resolving elements?
  // Also note that there could be multiple base tags, the logic for 
  // handling it properly is all laid out in some RFC standard somewhere, 
  // and is probably present in Webkit source.
  static resolveURLs(document, baseURL) {

  	const wrapped = HTMLDocumentWrapper.wrap(document);

  	// Remove base elements
  	const bases = wrapped.getElementsByTagName('base');
    bases.forEach(DocumentUtils._remove);

  	const attributeNamesMap = new Map([
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

  	// TODO: only select elements that have the attributes,
  	// e.g. script[src]

  	let keys = [];
  	attributeNamesMap.forEach(function(value, key) {
  	  keys.push(key + '[' + value +']');
  	});

    const selector = keys.join(',');
    const resolvables = wrapped.querySelectorAll(selector);
    resolvables.forEach(function(element) {
      const name = attributeNamesMap.get(element.localName);
      const url = element.getAttribute(name).trim();
      try {
        const uri = new URI(url);
        if(!uri.protocol()) {
          const resolved = uri.absoluteTo(baseURL).toString();
          element.setAttribute(name, resolved);
        }
      } catch(e) {

      }
    });
  }

  // Asynchronously attempts to set the width and height for 
  // all image elements
  // @param hostDocument a live document capable of fetching images
  static setImageDimensions(hostDocument, document, callback) {
    const images = document.getElementsByTagName('img');
    const fetchDimensions = ImageUtils.fetchDimensions.bind(null,
      hostDocument);
    async.forEach(images, fetchDimensions, callback);
  }
}
