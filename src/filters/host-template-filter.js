
import assert from "/src/assert.js";

// TODO: hostSelectorMap should be a parameter to this function so that configuration is defined
// externally so that it can be changed without needing to modify its internals (open-closed
// principle)

// @param doc {Document}
// @param url {URL}
export function hostTemplateFilter(doc, url) {
  assert(doc instanceof Document);
  if(!url) {
    return;
  }

  const hostSelectorMap = {};
  hostSelectorMap['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];
  hostSelectorMap['theweek.com'] = ['div#head-wrap'];
  hostSelectorMap['www.usnews.com'] = ['header.header'];

  const hostname = url.hostname;

  const selectors = hostSelectorMap[hostname];
  if(!selectors) {
    return;
  }

  console.log('hostTemplateFilter processing', url.href);

  const selector = selectors.join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements) {
    element.remove();
  }
}
