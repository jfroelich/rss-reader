
// TODO: doc should be first parameter
// TODO: rename, host_template should be prefix
// TODO: host_selector_map should be a parameter to this function so that
// configuration is defined externally so that it can be changed without
// needing to modify its internals (open-closed principle)
function host_template_prune(url_string, doc, verbose) {
  'use strict';
  const host_selector_map = {};
  host_selector_map['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  host_selector_map['theweek.com'] = ['div#head-wrap'];
  host_selector_map['www.usnews.com'] = ['header.header'];

  const hostname = url_get_hostname(url_string);
  if(!hostname)
    return;

  const selectors = host_selector_map[hostname];
  if(!selectors)
    return;

  if(verbose)
    console.debug('Template pruning', url_string);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements)
    element.remove();
}
