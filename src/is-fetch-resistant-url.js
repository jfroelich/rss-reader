// See license.md

'use strict';

// TODO: split up into interstitial.js and scripted.js or something like this

var rdr = rdr || {};
rdr.poll = rdr.poll || {};

rdr.poll.resistantHosts = [
  'productforums.google.com',
  'groups.google.com',
  'www.forbes.com',
  'forbes.com'
];

rdr.poll.isFetchResistantURL = function(url) {

  if(!isURLObject(url)) {
    throw new TypeError('invalid url param: ' + url);
  }

  // hostname getter normalizes to lowercase
  return rdr.poll.resistantHosts.includes(url.hostname);
};
