// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function transformFrames(document) {
  'use strict';

  let body = document.querySelector('body');
  const frameset = document.querySelector('frameset');
  if(!body && frameset) {
  	const noframes = frameset.querySelector('noframes');
  	body = document.createElement('body');
  	if(noframes) {
  	  body.innerHTML = noframes.innerHTML;
  	} else {
      body.textContent = 'Unable to display document due to frames.';
  	}

  	document.documentElement.appendChild(body);
  	frameset.remove();
  }
}
