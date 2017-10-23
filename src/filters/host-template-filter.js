'use strict';

// import base/status.js
// import http/url.js

// TODO: host_selector_map should be a parameter to this function so that
// configuration is defined externally so that it can be changed without
// needing to modify its internals (open-closed principle)

// @param url {String}
function host_template_filter(doc, url) {
  console.assert(doc instanceof Document)

  const host_selector_map = {};
  host_selector_map['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  host_selector_map['theweek.com'] = ['div#head-wrap'];
  host_selector_map['www.usnews.com'] = ['header.header'];

  const hostname = url_get_hostname(url);
  if(!hostname)
    return;

  const selectors = host_selector_map[hostname];
  if(!selectors)
    return;

  console.log('host_template_filter processing', url);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements) {
    element.remove();
  }

  return STATUS_OK;
}
