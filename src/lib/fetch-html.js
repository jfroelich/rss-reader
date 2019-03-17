import {better_fetch} from '/src/lib/better-fetch/better-fetch.js';

export default function fetch_html(url, options = {}) {
  // We may be modifying options, so clone to avoid side effects
  const opts = Object.assign({}, options);

  const types = ['text/html'];
  if (opts.allow_text) {
    types.push('text/plain');

    // Delete non-standard options in case the eventual native call to
    // fetch would barf on seeing them
    delete opts.allow_text;
  }
  opts.types = types;

  return better_fetch(url, opts);
}
