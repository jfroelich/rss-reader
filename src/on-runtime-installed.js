// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: use strict must be global to ensure ES6 lexical scope semantics
// TODO: double check this
'use strict';

{ // BEGIN FILE SCOPE

// Called when the extension is installed
// TODO: explicitly set the badge text to '0'?
// TODO: set localStorage defaults
function onRuntimeInstalled(event) {

  console.log('Installing extension...');

  // Trigger database upgrade by opening a connection
  openIndexedDB(function(event) {
    // NOOP
    // TODO: close the connection immediately?
  });
}

// Bind the listener
chrome.runtime.onInstalled.addListener(onRuntimeInstalled);

} // END FILE SCOPE
