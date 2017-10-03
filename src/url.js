
function url_get_hostname(url_string) {
  'use strict';
  let url_object;
  try {
    url_object = new URL(url_string);
    return url_object.hostname;
  } catch(error) {
  }
}
