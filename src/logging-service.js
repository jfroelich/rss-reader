// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class LoggingService {
  constructor(level) {
    this.level = level || LoggingService.LEVEL_OFF;
  }

  debug(...args) {
    if(this.level > LoggingService.LEVEL_OFF &&
      this.level < LoggingService.LEVEL_LOG) {
      console.debug.apply(console, args);
    }
  }

  log(...args) {
    if(this.level > LoggingService.LEVEL_OFF &&
      this.level < LoggingService.LEVEL_INFO) {
      console.log.apply(console, args);
    }
  }

  info(...args) {
    if(this.level > LoggingService.LEVEL_OFF &&
      this.level < LoggingService.LEVEL_WARN) {
      console.info.apply(console, args);
    }
  }

  warn(...args) {
    if(this.level > LoggingService.LEVEL_OFF &&
      this.level < LoggingService.LEVEL_ERROR) {
      console.warn.apply(console, args);
    }
  }

  error(...args) {
    if(this.level > LoggingService.LEVEL_OFF) {
      console.error.apply(console, args);
    }
  }
}

LoggingService.LEVEL_OFF = 0;
LoggingService.LEVEL_DEBUG = 1;
LoggingService.LEVEL_LOG = 2;
LoggingService.LEVEL_INFO = 3;
LoggingService.LEVEL_WARN = 4;
LoggingService.LEVEL_ERROR = 5;
