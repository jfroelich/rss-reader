// See license.md

'use strict';

// TODO: deprecate, the problem is that it obfuscates the stack trace of errors
// and  the source of messages

function LoggingService() {
  this.enabled = false;
}

LoggingService.prototype.debug = function() {
  if(this.enabled) {
    console.debug(...arguments);
  }
};

LoggingService.prototype.log = function() {
  if(this.enabled) {
    console.log(...arguments);
  }
};

LoggingService.prototype.error = function() {
  if(this.enabled) {
    console.error(...arguments);
  }
};

LoggingService.prototype.warn = function() {
  if(this.enabled) {
    console.warn(...arguments);
  }
};
