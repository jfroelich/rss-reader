// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Andy's chromebook does not support Map/Set in 36. Enabling experimental
// sort of works but map/set do not support constructor args. This is a quick
// dirty fix.

(function(exports) {
'use strict';

if(exports.Map) {
  return;
}

console.warn('Shimming Map/Set. Untested functionality');

var Map = function(iterable) {
  if(!iterable) return;
  this.data = {};
  iterable.forEach(function(entry) {
    this[entry[0]] = entry[1];
  }, this.data);
}

Map.prototype.set = function(k,v) {
  this.data[k] = v;
};

Map.prototype.get = function(k) {
  return this.data[k];
};

var Set = function(iterable) {
  if(!iterable) return;
  this.data = {};
  iterable.forEach(function(k) {
    this[k] = 1;
  }, this.data);
};

Set.prototype.forEach = function(cb) {
  Object.keys(this.data).forEach(cb);
};


exports.Map = Map;
exports.Set = Set;

}(this));