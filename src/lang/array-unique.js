// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: I feel like anything that wants a set of unique items would be better
// off just working with an actual set instead of an array. This is a caller
// concern but I am leaving this here as a general note. I feel like this
// function should not exist because its purpose is provided implicitly by
// understanding how 'new Set(array)' works. Another reason I do not like this
// is that it feels wasteful to convert from an array into a set and then back
// into an array. If the calling context approaches the collection of items
// more abstractly as an Iterable then there is even less of a need for this
// function. For example, for..of works on any iterable.

// NOTE: as a reminder, the spread operator also can work
// as a way of converting a set to an array, but Array.from feels clearer
// return [...new Set(array)];

// There are multiple ways of doing this operation. For now, I assume that
// passing the array to the Set constructor is probably more performant
// because the work is done all in native code, but I have never
// verified how this works.

// This was adapted from http://stackoverflow.com/questions/9229645
function uniqueArray(array) {
  'use strict';
  const set = new Set(array);
  return Array.from(set);
}
