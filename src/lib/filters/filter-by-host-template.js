
// TODO: return if no document.body
// TODO: restrict selectors to body
// TODO: move docs back to here as comments or write new ones
// TODO: rename url parameter to document-url or something that clarifies its
// role/purpose, the word by itself is too generic
// TODO: templates should come from the app and not be hardcoded here. So the
// map should be a parameter to the function, and defined externally (this
// doesn't care where or how, but probably in transform-document).
// TODO: it may be worth it to define a nice data structure object to represent
// the map, rather than require explicit knowledge of its internal structure


const host_selector_map = {};
host_selector_map['www.washingtonpost.com'] = [
  'header#wp-header', 'div.top-sharebar-wrapper', 'div.newsletter-inline-unit',
  'div.moat-trackable'
];
host_selector_map['theweek.com'] = ['div#head-wrap'];
host_selector_map['www.usnews.com'] = ['header.header'];


export function filter_by_host_template(document, url) {
  // document-url is currently an optional parameter but technically required
  // for this to avoid being a no-op, so for now this is a dumb fix
  if (!url) {
    return;
  }

  const hostname = url.hostname;
  const selectors = host_selector_map[hostname];
  if (!selectors) {
    return;
  }

  const selector = selectors.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    element.remove();
  }
}
