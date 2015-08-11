// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.hashing = {};

// Returns an integer hash code for a string, using a 
// simplified adaptation of some version found online
// TODO: research and document where I found the original
// code
lucu.hashing.generate = function(seed) {
  if(!seed) {
  	return 0;
  }

  var chars = seed.split('');
  return chars.reduce(lucu.hashing.update, 0);
};

lucu.hasing.update = function(sum, string) {
  return (sum * 31 + string.charCodeAt(0)) % 4294967296;
};
