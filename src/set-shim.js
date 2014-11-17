// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

(function(exports) {
'use strict';

// Andy's chromebook does not support Set in 36. Enabling experimental
// sort of works but map/set do not support constructor args. This is a quick
// dirty fix.

if(exports.Set) return;

var Set = function (iterable) {
  this.data = {};
  if(!iterable) return;
  iterable.forEach(function (k) {
    this[k] = true;
  }, this.data);
};

Set.prototype.add = function (k) {
  this.data[k] = true;
};

Set.prototype.forEach = function (fn) {
  Object.keys(this.data).forEach(fn);
};

Set.prototype.clear = function () {
  var self = this;
  this.forEach(function (k) { delete self.data[k]; });
};

Set.prototype.has = function (k) {
  return this.data.hasOwnProperty(k);
};

Set.prototype.size = function (k) {
  return Object.keys(this.data).length;
}

Set.prototype.values = function () {
  return new SetIterator(this);
};

function SetIterator(set) {
  var self = this;
  this.set = set;
  this.position = 0;

  this.next = function () {
    var size = self.set.size();
    if(self.position > size) {
      throw new Error('iterated past end of set');
    }

    if(self.position == size) {
      return {value:undefined};
    }

    self.position++;
    var key = Object.keys(self.set)[self.position];
    return {value: key};
  };
}

exports.Set = Set;

}(this));
