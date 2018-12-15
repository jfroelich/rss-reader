import assert from '/src/assert.js';
import {fetch_with_timeout} from '/src/base/fetch-with-timeout.js';
import * as mime from '/src/base/mime.js';

export async function fetch_image(url, options = {}) {
  assert(navigator && typeof navigator === 'object');
  assert(fetch && typeof fetch === 'function');
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  const default_fetch_options = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  // Use our explicit defaults over the browser's defaults
  const merged_options = Object.assign({}, default_fetch_options, options);

  const supported_methods = ['get', 'head'];
  const method = merged_options.method;
  assert(
      typeof method === 'string' &&
      supported_methods.includes(method.toLowerCase()));
  console.debug(method.toUpperCase(), url.href);

  if (!navigator.onLine) {
    throw new OfflineError('Offline when trying to fetch ' + url.href);
  }

  const response = await fetch_with_timeout(url, merged_options);

  if (!response.ok) {
    const message = 'Got a ' + response.status + ' ' + response.statusText +
        ' error fetching ' + url.href;
    throw new FetchError(message);
  }

  // Validate the response content type.
  const content_type = response.headers.get('Content-Type');
  if (content_type) {
    const mime_type = mime.parse_content_type(content_type);
    const image_mime_types = [
      'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
      'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
      'image/vnd.microsoft.icon'
    ];

    if (mime_type && !image_mime_types.includes(mime_type)) {
      const message = 'Response mime type ' + mime_type +
          ' unacceptable for url ' + url.href;
      throw new AcceptError(message);
    }
  }

  console.debug(response.status, response.statusText, url.href);
  return response;
}

export class AcceptError extends Error {}
export class OfflineError extends Error {}
export {TimeoutError} from '/src/base/fetch-with-timeout.js';
export class FetchError extends Error {}
