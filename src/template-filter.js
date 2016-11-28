// See license.md

'use strict';

class TemplateFilter {
  constructor() {
    this.templates = {};
  }

  add(hostname, newSelectors) {
    const oldSelectors = this.templates[hostname];
    if(oldSelectors) {
      this.templates[hostname] = oldSelectors.concat(newSelectors);
    } else {
      // NOTE: impure for better perf
      this.templates[hostname] = newSelectors;
    }
  }

  findSelectors(urlString) {
    const urlo = new URL(urlString);
    return this.templates[urlo.hostname];
  }

  // NOTE: logging is temp while monitoring new functionality

  prune(urlString, doc) {
    const selectors = this.findSelectors(urlString);
    if(!selectors)
      return;
    console.debug('Applying template filter to', urlString);
    const selector = selectors.join(',');
    const elements = doc.querySelectorAll(selector);
    for(let element of elements) {
      element.remove();
    }
  }
}
