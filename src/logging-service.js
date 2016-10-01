// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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
