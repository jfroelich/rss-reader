// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: we cannot use just article, because it screws up on certain pages.
// This may be a symptom of a larger problem of trying to use a fast path.
// For example, in https://news.vice.com/article/north-korea-claims-new-
// missile-engine-puts-us-within-nuclear-strike-range, it finds
// the one <article> element that isn't the desired best element.
// For now I am using this ugly hack to avoid that one error case. I really
// do not like this and it suggests the entire fast-path thing should be
// scrapped.

const CALAMINE_SIGNATURES = [
  'article:not([class*="ad"])',
  '.hentry',
  '.entry-content',
  '#article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
  '.repository-content',
  '[itemprop="articleBody"]',
  '[role="article"]',
  'DIV[itemtype="http://schema.org/Article"]',
  'DIV[itemtype="http://schema.org/BlogPosting"]',
  'DIV[itemtype="http://schema.org/Blog"]',
  'DIV[itemtype="http://schema.org/NewsArticle"]',
  'DIV[itemtype="http://schema.org/TechArticle"]',
  'DIV[itemtype="http://schema.org/ScholarlyArticle"]',
  'DIV[itemtype="http://schema.org/WebPage"]',
  '#WNStoryBody'
];

// Looks for the first single occurrence of an element matching
// one of the signatures
function calamine_find_signature(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const numSignatures = CALAMINE_SIGNATURES.length;

  // If a signature occurs once in a document, then return it. Use whatever
  // signature matches first in the order defined in CALAMINE_SIGNATURES
  for(let i = 0, elements; i < numSignatures; i++) {
    elements = bodyElement.querySelectorAll(CALAMINE_SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}
