// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: apply the blacklist filter after calamine instead of before
// maybe the blacklist filter should only flag elements instead
// of doing dom modification at first, and then do deferred manipulation?
// or maybe Calamine should be modified to include the blacklist filtering
// because it fits into original goal of boilerplate classification and 
// removal (instead of just identifying a best element)

function PreviewTransform$Transform(document) {
  'use strict';

  BlacklistFilter.transform(document);
  Calamine.transform(document, false);
  CommentFilter.transform(document);
  TrackingFilter.transform(document);
  HiddenElementFilter.transform(document);
  WhitespaceTransform.transform(document);
  InlineElementFilter.transform(document);
  
  const retainableAttributes = new Set([
    'href',
    'src'
  ]);

  filterAttributes(document, retainableAttributes);

  LeafFilter$Transform(document);
  ListTransform.transform(document);
  TrimDocument.transform(document);
}
