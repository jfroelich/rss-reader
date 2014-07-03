'use strict';
// TODO: eventually switch to moments.js and deprecate this


// Very simple date formatting.
function formatDate(date, sep) {
  if(date) {
    return [date.getMonth() + 1, date.getDate(),date.getFullYear()].join(sep || '');
  }

  return '';
}

// Very simple date parsing.
function parseDate(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  // Try to avoid returning an invalid date

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
}
