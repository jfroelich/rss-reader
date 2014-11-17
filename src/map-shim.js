// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Andy's chromebook does not support Map in 36. Enabling experimental
// sort of works but map/set do not support constructor args. This is a quick
// dirty fix.

(function(exports) {
'use strict';

if(exports.Map) return;

var Map = function (iterable) {
  this.keys = [];
  this.values = [];

  if(!iterable) return;
  iterable.forEach(function (entry) {
    this.set(entry[0], entry[1]);
  }, this);
};

Map.prototype.set = function (k, v) {
  var index = this.keys.indexOf(k);
  if(index == -1) {
    this.keys.push(k);
    this.values.push(v);
  } else {
    this.values[index] = v;
  }
};

Map.prototype.get = function (k) {
  var index = this.keys.indexOf(k);
  if(index != -1)
    return this.values[index];
};

exports.Map = Map;

}(this));
