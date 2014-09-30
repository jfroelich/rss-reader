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

// Primarily concerned with providing support, not replicating
// all functionality or having great performance

var Map = function(iterable) {
  this.keys = [];
  this.values = [];

  if(!iterable) return;
  for(var i = 0; i < iterable.length;i++) {
    this.set(iterable[i][0], iterable[i][1]);
  }
}

Map.prototype.set = function(k,v) {
  var index = this.keys.indexOf(k);
  if(index == -1) {
    this.keys.push(k);
    this.values.push(v);
  } else {
    this.values[index] = v;
  }
};

Map.prototype.get = function(k) {
  var index = this.keys.indexOf(k);
  if(index != -1) {
    return this.values[index];
  }
  // otherwise return undefined...
};

var Set = function(iterable) {
  this.data = {};
  if(!iterable) return;
  iterable.forEach(function(k) {
    this[k] = true;
  }, this.data);
};

Set.prototype.add = function(k) {
  this.data[k] = true;
};

Set.prototype.forEach = function(fn) {
  Object.keys(this.data).forEach(fn);
};

Set.prototype.clear = function () {
  var self = this;
  this.forEach(function (k) { delete self.data[k]; });
};

Set.prototype.has = function(k) {
  return this.data.hasOwnProperty(k);
};

Set.prototype.size = function(k) {
  return Object.keys(this.data).length;
}

Set.prototype.values = function() {
  return new SetIterator(this);
};

function SetIterator(set) {
  var self = this;
  this.set = set;
  this.position = 0;

  this.next = function() {
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


exports.Map = Map;
exports.Set = Set;

}(this));