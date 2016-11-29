// See license.md

'use strict';

class TemplateFilter {
  constructor() {
    this.templates = {};
  }

  // Note that newSelectors is not cloned
  add(hostname, newSelectors) {
    const oldSelectors = this.templates[hostname];
    if(oldSelectors) {
      this.templates[hostname] = oldSelectors.concat(newSelectors);
    } else {
      this.templates[hostname] = newSelectors;
    }
  }

  findSelectors(urlString) {
    const urlo = new URL(urlString);
    return this.templates[urlo.hostname];
  }

  prune(urlString, doc) {
    const selectors = this.findSelectors(urlString);
    if(!selectors)
      return;
    // NOTE: temp while evaluating new functionality
    console.debug('Applying template filter to', urlString);
    const selector = selectors.join(',');
    const elements = doc.querySelectorAll(selector);
    for(let element of elements) {
      element.remove();
    }
  }
}
