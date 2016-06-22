// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// A quick and dirty way to get a formatted date string, probably needs some
// improvement eventually.
function formatDate(date, optionalDelimiterString) {
  const datePartsArray = [];
  if(date) {
    datePartsArray.push(date.getMonth() + 1);
    datePartsArray.push(date.getDate());
    datePartsArray.push(date.getFullYear());
  }
  return datePartsArray.join(optionalDelimiterString || '');
}
