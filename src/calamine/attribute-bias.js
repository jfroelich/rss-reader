// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: if I stop using the fast path of find-signature.js, and I return to
// individually weighting blocks, I should expand this list.

// If one of these tokens is found in an attribute value of an element,
// these bias the element's boilerplate score. A higher score means that the
// element is more likely to be content. This list was gathered empirically and
// the weighting was chosen empirically.
const CALAMINE_ATTRIBUTE_BIAS_TOKEN_WEIGHTS = {
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

// Computes a bias for an element based on the values of some of its
// attributes.
function calamine_derive_attribute_bias(element) {
  'use strict';

  // As much as I would look to organize the statements of this function into
  // smaller helper functions, this is a hotspot, so I have inlined
  // everything. Maybe I can return at a later time and try again once V8
  // stabilizes more.

  // TODO: maybe id and name do not need to be tokenized. I think the spec
  // declares that such values should not contain spaces. On the other hand,
  // what about hyphen or underscore separated terms? If they do not need to
  // be tokenized they could become the first two entries in the token array.
  // I guess it is a question of comparing the desired accuray to the desired
  // performance.

  // Start by merging the element's interesting attribute values into a single
  // string in preparation for tokenization.
  // Accessing attributes by property is faster than using getAttribute. It
  // turns out that getAttribute is horribly slow in Chrome. I have not figured
  // out why, and I have not figured out a workaround. I forgot to record the
  // testing or cite here. The one workaround I thought of was calling
  // element.outerHTML, parsing the element's tag text, parsing its attributes,
  // and doing it all myself. My suspicion is that would be even slower.
  // TODO: test if using hasAttribute speeds it up?
  const valuesArray = [element.id, element.name, element.className];

  // Array.prototype.join implicitly filters null/undefined values so we do not
  // need to check if the property values are defined.
  const valuesString = valuesArray.join(' ');

  // If the element did not have any values for the attributes checked,
  // then values will only contain a small string of spaces or some negligible
  // token so we exit early to minimize the work done.
  if(valuesString.length < 3) {
    // TODO: maybe this should return 0 if coercion is the caller's
    // responsibility.
    // TODO: maybe I want to declare total bias before this and return total
    // bias here so that I am more consistent about the value returned and its
    // type, so it serves as a better reminder.
    return 0.0;
  }

  // Lowercase the values in one pass. Even though toLowerCase now has to
  // consider extra spaces in its input because it occurs after the join, we
  // don't have to check if inputs are defined non-natively because join did
  // that for us. Also, this is one function call in constrast to 3. toLowerCase
  // scales better with larger strings that the JS engine scales with function
  // calls.
  const lowerCaseValuesString = valuesString.toLowerCase();

  // Tokenize the values into word-like tokens
  // TODO: why am i even seeing empty strings or whitespace only strings?
  // Isn't this greedy?
  const tokenArray = lowerCaseValuesString.split(/[\s\-_0-9]+/g);

  // Now add up the bias of each distinct token. Previously this was done in
  // two passes, with the first pass generating a new array of distinct tokens,
  // and the second pass summing up the distinct token biases. I seem to get
  // better performance without creating an intermediate array.

  // Avoid calculating loop length per iteration as it is invariant
  const tokenArrayLength = tokenArray.length;

  // The set of seen token strings. I am using a plain object instead of a
  // Set due to performance.
  const seenTokenSet = {};

  let totalBias = 0;
  let bias = 0;
  let token;

  // TODO: maybe keeping track of the number of tokens added to 'seen' would
  // help reduce the number of calls to 'in'? Similarly, I could also check
  // if i > 0. Because the token will never be in seen in the first iteration.
  // But would that improve the perf? How expensive is 'in'?

  for(let i = 0; i < tokenArrayLength; i++) {
    token = tokenArray[i];

    // Split can yield empty strings for some reason, so skip those.
    if(!token) {
      continue;
    }

    // Check if the token is a duplicate
    if(token in seenTokenSet) {
      continue;
    } else {
      // Let later iterations know of the dup
      seenTokenSet[token] = 1;
    }

    // Adjust total bias if there is a bias for the token
    bias = CALAMINE_ATTRIBUTE_BIAS_TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias += bias;
    }
  }

  // TODO: maybe type coercion is responsibility of the caller
  return 0.0 + totalBias;
}
