// See license.md

'use strict';

function isScriptGeneratedContent(url) {
  if(!isURLObject(url)) {
    throw new TypeError();
  }

  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
}
