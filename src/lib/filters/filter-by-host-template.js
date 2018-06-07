// A basic map from host to an array of selectors
const hsm = {};
hsm['www.washingtonpost.com'] = [
  'header#wp-header', 'div.top-sharebar-wrapper', 'div.newsletter-inline-unit',
  'div.moat-trackable'
];
hsm['theweek.com'] = ['div#head-wrap'];
hsm['www.usnews.com'] = ['header.header'];


export function filter_by_host_template(document) {
  // Grab the document's url from its baseURI.
  const url = new URL(document.baseURI);

  // Basic sanity check as url is required
  if (!url) {
    return;
  }

  const hostname = url.hostname;
  const selectors = hsm[hostname];
  if (!selectors) {
    return;
  }

  const selector = selectors.join(',');
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    element.remove();
  }
}
