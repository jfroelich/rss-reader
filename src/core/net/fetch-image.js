import {better_fetch} from '/src/core/net/net.js';
import {assert} from '/src/lib/assert.js';

export function fetch_image(url, options = {}) {
  assert(url instanceof URL);
  assert(options && typeof options === 'object');
  const local_options = Object.assign({}, options);
  local_options.types = [
    'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
    'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
    'image/vnd.microsoft.icon'
  ];
  return better_fetch(url, local_options);
}
