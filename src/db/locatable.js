import assert from '/src/lib/assert.js';

// A locatable is an object that contains an urls property indicating that
// object's locations (as an array of url strings), and supports operations that
// modify location. locations must be unique, which would seem like a good fit
// for a Set, but Set is slow, and there are problems storing sets in indexedDB

// Append the url to the locatable resource. Returns true if the url was
// distinct from the existing urls and therefore appended. Return false if the
// url was not appended.
export function append_url(locatable, url) {
  const url_string = url.href;
  if (locatable.urls) {
    if (locatable.urls.includes(url_string)) {
      return false;
    }

    locatable.urls.push(url_string);
  } else {
    locatable.urls = [url_string];
  }

  return true;
}

export function has_url(locatable) {
  return locatable.urls.length;
}

// Returns the last url in the locatables list of urls as a url string. Throws
// an error if the locatable object is not a locatable or has no urls.
export function get_url_string(locatable) {
  assert(has_url(locatable));
  return locatable.urls[locatable.urls.length - 1];
}

// Returns the last url in the locatables url list as a URL object. Throws an
// error if the locatable is invalid or if the locatable has no urls or if the
// url is malformed.
export function get_url(locatable) {
  return new URL(get_url_string(locatable));
}
