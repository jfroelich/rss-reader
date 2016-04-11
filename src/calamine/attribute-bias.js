// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// Derives a bias to an element's score based on its attributes
// TODO: maybe it is ok to assume that id and name are always single
// words and never multi-word values, and maybe i only need to
// calamine_tokenize className, does the spec say id cannot have space?
// TODO: improve performance
// TODO: use const/let once I figure out why I keep getting a profiler
// warning about "unsupported phi use of const variable"
function calamine_derive_attribute_bias(element) {
  'use strict';

  var TOKEN_WEIGHTS = {
    'ad': -500,
    'ads': -500,
    'advert': -500,
    'article': 500,
    'body': 500,
    'comment': -500,
    'content': 500,
    'contentpane': 500,
    'gutter': -300,
    'left': -50,
    'main': 500,
    'meta': -50,
    'nav': -200,
    'navbar': -200,
    'newsarticle': 500,
    'page': 200,
    'post': 300,
    'promo': -100,
    'rail': -300,
    'rel': -50,
    'relate': -500,
    'related': -500,
    'right': -50,
    'social': -200,
    'story': 100,
    'storytxt': 500,
    'tool': -200,
    'tools': -200,
    'widget': -200,
    'zone': -50
  };

  // Merge attribute values into a single string
  // Accessing attributes by property is faster than using getAttribute
  // The join implicitly filters null values
  var valuesArray = [element.id, element.name, element.className];
  var values = valuesArray.join(' ');

  // If the element did not have any values for the attributes checked,
  // then values will only contain a small string of spaces so we exit early
  // to minimize the work done.
  if(values.length < 3) {
    return 0.0;
  }

  // Normalize
  var lowerValues = values.toLowerCase();

  // Tokenize into words
  var tokens = lowerValues.split(/[\s\-_0-9]+/g);

  // Add up the bias of each distinct token
  var numTokens = tokens.length;
  var seen = {};
  var totalBias = 0;
  for(var i = 0, bias = 0, token = ''; i < numTokens; i = i + 1) {
    token = tokens[i];

    if(!token) {
      continue;
    }

    if(token in seen) {
      continue;
    }

    seen[token] = 1;
    bias = TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  var totalBiasAsLong = 0.0 + totalBias;
  return totalBiasAsLong;
}
