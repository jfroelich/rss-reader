// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Faster than Array.prototype.filter because assumes that the input array
// is dense, and because it does not support custom binding.
function array_filter(inputArray, predicateFunction) {
  'use strict';
  const length = inputArray.length;
  const outputArray = [];
  for(let i = 0, item; i < length; i++) {
    item = inputArray[i];
    if(predicateFunction(item)) {
      outputArray.push(item);
    }
  }
  return outputArray;
}

// Faster than Array.prototype.find because assumes the subject array
// is dense.
// The predicate function should be pure, and especially, it should not modify
// the subject array.
function array_find(subjectArray, predicateFunction) {
  'use strict';
  const length = subjectArray.length;
  for(let i = 0, item; i < length; i++) {
    item = subjectArray[i];
    if(predicateFunction(item)) {
      return item;
    }
  }
}

// Faster than Array.prototype.forEach because assumes dense
function array_for_each(subjectArray, callback) {
  'use strict';
  const length = subjectArray.length;
  for(let i = 0; i < length; i++) {
    callback(subjectArray[i]);
  }
}

// Returns true if the predicate returns true for at least one item of the
// subject array.
// This is faster than Array.prototype.some because it assumes the subject
// array is dense.
function array_some(subjectArray, predicateFunction) {
  'use strict';
  const length = subjectArray.length;
  for(let i = 0; i < length; i++) {
    if(predicateFunction(subjectArray[i])) {
      return true;
    }
  }
  return false;
}
