
var dates = {};

// Extremely simple date formatting
dates.formatDate = function(date, sep) {
  
  if(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()
      ].join(sep || '-');
  }
  
  return '';
};

// Extremely simple (and naive) date parsing.
dates.parseDate = function(str) {
  if(!str) {
    return;
  }
  
  var date = new Date(str);
  
  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }
  
  if(!isFinite(date)) {
    return;
  }

  return date;
};