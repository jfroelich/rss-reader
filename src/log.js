// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Experimenting with the idea of mimicing Java logging style
// and with ES6 class extension

class Log extends Console {
  static log(type, ...args) {
  	if(Log._isTypeEnabled(type)) {
  	  super.log(args);
  	}
  }

  static _isTypeEnabled(type) {
  	return Log.TYPES.get(type);
  }
}

Log.TYPES = new Map([
  ['POLL', true],
  ['ARCHIVE', true]
]);
