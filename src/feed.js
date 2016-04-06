// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Feed routines. One of the main goals is to centralize all functions that
// access or manipulate feed properties, so that if I need to make a change
// to feed properties, I can easily also change the dependent functions.

// TODO: the other idea i am considering is using a Feed function object
// instead of an object literal. It makes sense to use an object in this case
// to represent a bag of properties.

// The main issue is that I do not have a complete understanding of how
// indexedDB stores function objects due to how its structured cloning
// algorithm works. For example, is the prototype of the object stored?
