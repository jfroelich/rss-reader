// String utilities
(function(exports) {
'use strict';

exports.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Truncates a string
// ext is optional override of default ellipsis replacement
exports.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};


function getEntityCode(entityCharacter) {
  return '&#' + entityCharacter.charCodeAt(0) + ';';
}

// & not being escaped at the moment, intentionally
exports.escapeHTML = function(str) {
  if(str) {
    return str.replace(/[<>"”'`]/g, getEntityCode);
  }
};

exports.escapeHTMLAttribute = function(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
};

exports.escapeHTMLInputValue = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};

exports.escapeHTMLHREF = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};


}(this));