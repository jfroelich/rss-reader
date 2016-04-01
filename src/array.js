// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function array_filter(subject, predicate) {
  'use strict';

  const length = subject.length;
  const result = [];

  for(let i = 0, item; i < length; i++) {
    item = subject[i];
    if(predicate(item)) {
      result.push(item);
    }
  }

  return result;
}

// faster than Array.prototype.find because assumes dense
function array_find(subject, predicate) {
  'use strict';
  const length = subject.length;
  for(let i = 0, item; i < length; i++) {
    item = subject[i];
    if(predicate(item)) {
      return item;
    }
  }
}

// faster than Array.prototype.forEach because assumes dense
function array_for_each(subject, callback) {
  'use strict';
  const length = subject.length;
  for(let i = 0; i < length; i++) {
    callback(subject[i]);
  }
}

// faster than Array.prototype.some because assumes dense
function array_some(subject, predicate) {
  'use strict';
  const length = subject.length;
  for(let i = 0; i < length; i++) {
    if(predicate(subject[i])) {
      return true;
    }
  }
  return false;
}
