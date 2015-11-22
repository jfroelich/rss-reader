// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: apply the blacklist filter after calamine instead of before
// maybe the blacklist filter should only flag elements instead
// of doing dom modification at first, and then do deferred manipulation?
// or maybe Calamine should be modified to include the blacklist filtering
// because it fits into original goal of boilerplate classification and 
// removal (instead of just identifying a best element)

const PreviewTransform = {};

PreviewTransform.transform = function(document) {

  const PIPELINE = [
    BlacklistFilter,
    Calamine,
    CommentFilter,
    TrackingFilter,
    HiddenElementFilter,
    WhitespaceTransform,
    InlineElementFilter,
    AttributeFilter,
    LeafFilter,
    ListTransform,
    TrimDocument
  ];

  const length = PIPELINE.length;
  for(let i = 0; i < length; i++) {
    PIPELINE[i].transform(document);
  }
};
