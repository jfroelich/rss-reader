// See license.md

'use strict';

// TODO: rename to CustomConsole
// appear like it is typeof console, and can work as a drop in replacement

// TODO: the problem with this is that it obfuscates which file printed the
// the message, everything now comes from logging service, so maybe deprecate

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
