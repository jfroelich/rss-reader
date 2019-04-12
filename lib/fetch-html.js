import { betterFetch } from '/lib/better-fetch.js';

export default function fetchHTML(url, options = {}) {
  // We may be modifying options, so clone to avoid side effects
  const opts = Object.assign({}, options);

  const types = ['text/html'];
  if (opts.allowText) {
    types.push('text/plain');

    // Delete non-standard options in case the eventual native call to
    // fetch would barf on seeing them
    delete opts.allowText;
  }
  opts.types = types;

  return betterFetch(url, opts);
}
