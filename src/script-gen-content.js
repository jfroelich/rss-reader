// See license.md

'use strict';

function is_script_generated_content(url) {
  if(!is_url_object(url))
    throw new TypeError();
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
}
