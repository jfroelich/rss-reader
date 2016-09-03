// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: this is shallow. If a property is an object, its fields are not
// affected.
// TODO: do I even want to restrict to own props?
// TODO: should I be using Object.create(null) instead of {} ?
// TODO: because i test for null, maybe rename to filter_empty_props
// TODO: what is better/faster? typeof or === undefined keyword?
// TODO: should clone be an option? like a flag, only clone if needed
// TODO: test how assign clones dates and url objects?

function filter_undef_props(obj) {

  // Assume always defined
  console.assert(obj);

  // Clone the object to ensure purity. Assume the input is immutable.
  const clone = Object.assign({}, obj);

  // Alias the native hasOwn in case the object's hasOwn is impure
  const hasOwn = Object.prototype.hasOwnProperty;

  const undef = void(0);

  for(let prop in clone) {
    if(hasOwn.call(clone, prop)) {
      if(clone[prop] === undef || clone[prop] === null) {
        delete clone[prop];
      }
    }
  }

  return clone;
}
