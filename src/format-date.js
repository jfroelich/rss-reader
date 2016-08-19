// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


// Formats a date object. This is obviously a very dumb implementation that
// could eventually be improved.
function format_date(date, delimiter) {
  const datePartsArray = [];
  if(date) {
    // getMonth is a zero based index
    datePartsArray.push(date.getMonth() + 1);
    datePartsArray.push(date.getDate());
    datePartsArray.push(date.getFullYear());
  }
  return datePartsArray.join(delimiter || '');
}
