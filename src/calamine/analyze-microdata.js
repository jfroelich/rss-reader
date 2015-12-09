// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: schemas can probably be treated as fast paths
// and so we don't need this separate lib for that purpose.
// Instead, we want this separate lib for the other microdata
// attributes. and furthermore, we probably just want to
// roll this into the analyzeAttributes lib

// TODO: itemscope?
// TODO: itemprop="articleBody"?
// TODO: [role="article"]?
// 'complementary' negative role
// 'blogpost' positive itemprop

{ // BEGIN ANONYMOUS NAMESPACE

// Microdata schemas
const SCHEMAS = new Set([
  'Article',
  'Blog',
  'BlogPost',
  'BlogPosting',
  'NewsArticle',
  'ScholarlyArticle',
  'TechArticle',
  'WebPage'
]);

function analyzeMicrodata(document) {
  const scores = new Map();
  let selector = null,
    elements = null,
    element = null;

  for(let schema of SCHEMAS) {
    selector = '[itemtype="http://schema.org/' + schema + '"]';
    elements = document.querySelectorAll(selector);
    if(elements.length === 1) {
      element = elements[0];
      scores.set(element, (scores.get(element) || 0.0) + 500.0);
    }
  }

  return scores;
}

this.analyzeMicrodata = analyzeMicrodata;

} // END ANONYMOUS NAMESPACE
