// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/*
This is not currently in use, it is a placeholder to represent
the idea of improving support for documents that use lazy-loader
techniques. For example: <img src="//pop.h-cdn.co/assets/popularmechanics/
20151117153941/images/blank.png" class="lazy-image" 
data-src="//pop.h-cdn.co/assets/popularmechanics/20151117153941
/images/logo-network-men.png" >.

Maybe what we do is scan all attributes for values that look like 
urls and try and resolve them?
http://stackoverflow.com/questions/1500260
*/

const LazyLoadTransform = {};

{ // BEGIN ANONYMOUS NAMESPACE

LazyLoadTransform.transform = function LazyLoadTransform$Transform(document) {
  throw new Error('Not implemented');
};

} // END ANONYMOUS NAMESPACE
