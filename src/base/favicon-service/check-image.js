import * as mime from '/src/base/mime.js';

// Send a head request for an image, and return true if the image exists, and is
// in range, and of the proper type. May throw errors
async function check_image(url, size_constraints, timeout) {
  if (!navigator.onLine) {
    console.debug('request failed while offline', url);
    return false;
  }

  const fetch_options = {
    credentials: 'omit',
    method: 'head',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  console.debug('HEAD', url);

  let response;
  if (timeout) {
    const timed_promise = delayed_resolve(timeout);
    const response_promise = fetch(url, fetch_options);
    response = await Promise.race([timed_promise, response_promise]);
  } else {
    response = await fetch(url, fetch_options);
  }

  if (!response) {
    console.log('request timed out', url, timeout);
    return false;
  }

  if (!response.ok) {
    console.debug('response not ok', url, response.status, response.statusText);
    return false;
  }

  const content_length = response.headers.get('Content-Length');
  if (content_length) {
    const length = parseInt(content_length, 10);
    if (!isNaN(length)) {
      if (length < size_constraints.min || length > size_constraints.max) {
        console.debug('response size out of bounds', url, length);
        return false;
      }
    }
  }

  const content_type = response.headers.get('Content-Type');
  if (content_type) {
    const mime_type = mime.parse_content_type(content_type);
    const image_mime_types = [
      'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
      'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
      'image/vnd.microsoft.icon'
    ];

    if (mime_type && !image_mime_types.includes(mime_type)) {
      console.debug('response type unacceptable', url, content_type);
      return false;
    }
  }

  return true;
}

// After a given delay in millis, resolve
function delayed_resolve(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}
