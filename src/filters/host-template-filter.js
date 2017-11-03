'use strict';

// import base/assert.js
// import base/errors.js
// import net/url-utils.js

// TODO: hostSelectorMap should be a parameter to this function so that
// configuration is defined externally so that it can be changed without
// needing to modify its internals (open-closed principle)

// @param url {String}
function hostTemplateFilter(doc, url) {
  assert(doc instanceof Document)

  const hostSelectorMap = {};
  hostSelectorMap['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  hostSelectorMap['theweek.com'] = ['div#head-wrap'];
  hostSelectorMap['www.usnews.com'] = ['header.header'];

  const hostname = URLUtils.getHostname(url);
  if(!hostname) {
    return;
  }

  const selectors = hostSelectorMap[hostname];
  if(!selectors) {
    return;
  }

  console.log('hostTemplateFilter processing', url);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements) {
    element.remove();
  }

  return RDR_OK;
}
