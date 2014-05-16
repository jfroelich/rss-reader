// Date lib
(function(exports) {
'use strict';

// Very simple date formatting
exports.formatDate = function(date, sep) {
  if(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()
      ].join(sep || '-');
  } else {
    return '';
  }
};

// Very simple date parsing
exports.parseDate = function(str) {
  if(str) {
    var date = new Date(str);
    if(Object.prototype.toString.call(date) == '[object Date]' &&
      isFinite(date)) {
      return date;
    }
  }
};

}(this));