import * as url_utils from '/src/url-utils/url-utils.js';
import {fetch_image_element, is_ephemeral_fetch_error} from '/src/net/fetch-image-element.js';
import {AssertionError} from '/src/assert.js';

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this attempts to infer the
// dimensions for each image and modifies each image element's attributes.
export async function image_size_filter(document, timeout, is_allowed_request) {
  // This is similar to a programmer error, but it is not invariant, so it is
  // better to use a typical sanity check here instead of an assert.
  if (!document.baseURI) {
    throw new TypeError('document missing baseURI');
  }

  // This only pays attention to image elements within body, and assumes that
  // the HTML parsing that generated the Document object did implied
  // transformations that moved out of body content to within body, and that
  // even if after those implied changes the body is empty, there is nothing
  // to do.
  if (!document.body) {
    return;
  }

  const images = document.body.getElementsByTagName('img');
  const promises = [];
  for (const image of images) {
    promises.push(get_image_dims(image, timeout, is_allowed_request));
  }
  const infos = await Promise.all(promises);

  for (const info of infos) {
    if (info.width && info.height) {
      info.image.setAttribute('width', info.width);
      info.image.setAttribute('height', info.height);
    }
  }
}

// Finds the dimensions of an image based on its HTML attributes
function find_attribute_dimensions(image) {
  const info = {width: 0, height: 0};
  if (image.hasAttribute('width')) {
    info.width = image.width;
  }

  if (image.hasAttribute('height')) {
    info.height = image.height;
  }

  return info;
}

// Finds the dimensions of an image. This first looks at information that is
// available within the document, and if that fails, then fallsback to doing
// a network request.
async function get_image_dims(image, timeout, is_allowed_request) {
  const attribute_info = find_attribute_dimensions(image);
  if (attribute_info.width && attribute_info.height) {
    return {
      image: image,
      reason: 'attributes',
      width: attribute_info.width,
      height: attribute_info.height
    };
  }

  const style_info = find_style_dimensions(image);
  if (style_info.width && style_info.height) {
    return {
      image: image,
      reason: 'style',
      width: style_info.width,
      height: style_info.height
    };
  }

  // The remaining checks require use of the src attribute. If that is not
  // available then exit early. While the src property imputes an absolute
  // url (based on baseURI and the src attribute), it is empty when the src
  // attribute is missing (there is no risk baseURI is provided).
  if (!image.src) {
    return {image: image, reason: 'sourceless'};
  }

  // Parse the value of the src property into a URL object. This validates the
  // url's syntax. This makes it easy to inspect more atomic properties of the
  // url in separate checks. This avoids the need to repeatedly parse later.
  let source_url;
  try {
    source_url = new URL(image.src);
  } catch (error) {
    return {image: image, reason: 'badsource'};
  }

  let url_info = find_url_dimensions(source_url);
  if (url_info) {
    return {
      image: image,
      reason: 'url-sniff',
      width: url_info.width,
      height: url_info.height
    };
  }

  let fetched_image;
  try {
    fetched_image =
        await fetch_image_element(source_url, timeout, is_allowed_request);
  } catch (error) {
    // Never suppress assertion errors (programmer errors). Any catch block is
    // suspect. Here I know that, currently, fetch_image_element does
    // assertions, so this check is correct.
    if(error instanceof AssertionError) {
      throw error;
    }

    // Handle certain fetch errors, like a timeout, as non-programming errors
    if (is_ephemeral_fetch_error(error)) {
      return {image: image, reason: 'fetch-error'};
    }

    throw error;
  }

  const info = {
    image: image,
    reason: 'fetch',
    width: fetched_image.width,
    height: fetched_image.height
  };

  return info;
}

// Try and find image dimensions from the characters of a url
function find_url_dimensions(source_url) {
  if (source_url.protocol === 'data:') {
    return;
  }

  const ext = url_utils.get_extension(source_url);
  if (!ext) {
    return;
  }

  const supported_extensions = ['jpg', 'gif', 'svg', 'jpg', 'bmp', 'png'];
  if (!supported_extensions.includes(ext)) {
    return;
  }

  // TODO: this code has a ton of nested blocks and is too difficult to read
  // and modify. Rewrite. Also, it is ok to set height even if width not set,
  // so the height stuff does not need to happen only in the width block.

  const named_attr_pairs =
      [{width: 'w', height: 'h'}, {width: 'width', height: 'height'}];

  // Infer from url parameters
  const params = source_url.searchParams;
  for (const pair of named_attr_pairs) {
    const width_string = params.get(pair.width);
    if (width_string) {
      const width_int = parseInt(width_string, 10);
      if (!isNaN(width_int)) {
        const height_string = params.get(pair.height);
        if (height_string) {
          const height_int = parseInt(height_string, 10);
          if (!isNaN(height_int)) {
            const dimensions = {};
            dimensions.width = width_int;
            dimensions.height = height_int;
            return dimensions;
          }
        }
      }
    }
  }
}

// Attempt to find the dimensions from the element's attributes
function find_style_dimensions(element) {
  const dimensions = {width: 0, height: 0};

  // TODO: this needs to correctly handle other image size formats, like width
  // as a percentage and such
  // Units are implicitly ignored in parseInt, this naively assumes pixel width
  // in all cases but that could be incorrect
  // TODO: look into using CSSOM

  if (element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if (!isNaN(width)) {
      dimensions.width = width;
    }

    const height = parseInt(element.style.height, 10);
    if (!isNaN(height)) {
      dimensions.height = height;
    }
  }

  return dimensions;
}