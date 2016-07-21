// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class LoggingService {
  constructor() {
    this.level = LoggingService.LEVEL_LOG;
    this.active = true;
  }

  debug(...args) {
    if(this.active && this.level >= LoggingService.LEVEL_DEBUG) {
      console.debug.apply(console, args);
    }
  }

  log(...args) {
    if(this.active && this.level >= LoggingService.LEVEL_LOG) {
      console.log.apply(console, args);
    }
  }

  warn(...args) {
    if(this.active && this.level >= LoggingService.LEVEL_WARN) {
      console.warn.apply(console, args);
    }
  }

  error(...args) {
    if(this.active) {
      console.error.apply(console, args);
    }
  }
}

LoggingService.LEVEL_DEBUG = 1;
LoggingService.LEVEL_LOG = 2;
LoggingService.LEVEL_WARN = 3;
LoggingService.LEVEL_ERROR = 4;

class DummyLoggingService extends LoggingService {
  log () {}
  debug () {}
  warn() {}
  error() {}
}
