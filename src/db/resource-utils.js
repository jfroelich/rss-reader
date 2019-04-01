import assert from '/src/lib/assert.js';

// Returns whether the given value represents a valid object identifier in the
// datbase
export function is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// If a {URL} url is distinct from a resource's other urls, append the url to
// the resource. Returns whether appended. This accepts a url object instead
// of a string to ensure the url is well-formed, absolute, and canonical,
// although the url is recorded in string form in the resource's urls list.
export function set_url(resource, url) {
  const url_string = url.href;
  if (resource.urls) {
    if (resource.urls.includes(url_string)) {
      return false;
    }

    resource.urls.push(url_string);
  } else {
    resource.urls = [url_string];
  }

  return true;
}

export function has_url(resource) {
  return resource.urls && resource.urls.length;
}

// Returns the last url in the resource's list of urls as a url string. Throws
// an error if the resource object is not a resource or has no urls.
export function get_url_string(resource) {
  assert(has_url(resource));
  return resource.urls[resource.urls.length - 1];
}

// Returns the last url in the resource's url list as a URL object. Throws an
// error if the resource is invalid or if the resource has no urls or if the
// url is malformed.
export function get_url(resource) {
  return new URL(get_url_string(resource));
}

// Mutate the input resource object such that its properties are normalized. For
// example, strings with different unicode encodings become canonical. This does
// not normalize urls. See https://unicode.org/reports/tr15/ for more info.
export function normalize(resource) {
  if (resource.author) {
    resource.author = resource.author.normalize();
  }

  if (resource.title) {
    resource.title = resource.title.normalize();
  }

  if (resource.content) {
    resource.content = resource.content.normalize();
  }

  if (resource.description) {
    resource.description = resource.description.normalize();
  }
}
