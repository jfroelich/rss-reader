// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
// idea of doing all adapting the scoring to allow for 
// dirty stuff, and then doing all the removal and unwrapping
// after in a separate transformation
// this makes determining the text length more difficult, would 
// need to only count non-white-space
// would need to negatively weight elements that would also be 
// filtered out by the blacklist removal transform. If I recall
// the original thought was that early removal would speed up 
// analysis but i am really beginning to dislike how it is all
// mixed together
const PreviewTransform = {};

PreviewTransform.transform = function(document, rest) {

  // todo: consider simply iterating over an 
  // array of transforms in a series

  CommentFilter.transform(document);
  BlacklistFilter.transform(document);
  TrackingFilter.transform(document);
  FallbackElementsHandler.transform(document);
  HiddenElementFilter.transform(document);
  WhitespaceTransform.transform(document);
  Calamine.transform(document, rest);
  InlineElementFilter.transform(document);
  AttributeFilter.transform(document);
  LeafFilter.transform(document);
  ListTransform.transform(document);
  TrimDocument.transform(document);
};