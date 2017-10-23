'use strict';

function date_format(date_object, delimiter) {

  // TODO: assert date_object is date
  console.assert(date_object);

  // Tolerate some bad input
  if(!date_object) {
    return '';
  }

  const parts = [];
  // Add 1 because getMonth is a zero based index
  parts.push(date_object.getMonth() + 1);
  parts.push(date_object.getDate());
  parts.push(date_object.getFullYear());
  return parts.join(delimiter || '/');
}
