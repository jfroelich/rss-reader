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

TODO: lazy load might also have to happen prior to
fetching image dimensions so that we can also fetch the dimensions
for lazy loaded images

TODO: therefore, lazy load also has to happen prior to resolving
document urls so that lazy-load urls are also fixed

*/

const LazyLoadTransform = {};

{ // BEGIN ANONYMOUS NAMESPACE

this.transformLazyLoadElements = function _transform(document) {
  throw new Error('Not implemented');
};

} // END ANONYMOUS NAMESPACE
