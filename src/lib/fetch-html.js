import { betterFetch } from '/src/lib/better-fetch.js';

export default function fetchHTML(url, options = {}) {
  // We may be modifying options, so clone to avoid side effects
  // TODO: use the destructuring clone technique over Object.assign per AirBnB style guide
  const opts = Object.assign({}, options);

  const types = ['text/html'];
  if (opts.allowText) {
    types.push('text/plain');
    // Delete non-standard options in case the eventual native call to fetch would barf
    delete opts.allowText;
  }
  opts.types = types;

  return betterFetch(url, opts);
}
