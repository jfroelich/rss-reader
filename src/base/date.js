// Date object utilities

'use strict';

function date_format(date_object, delimiter) {
  const parts = [];
  if(date_object) {
    // getMonth is a zero based index
    parts.push(date_object.getMonth() + 1);
    parts.push(date_object.getDate());
    parts.push(date_object.getFullYear());
  }
  return parts.join(delimiter || '/');
}
