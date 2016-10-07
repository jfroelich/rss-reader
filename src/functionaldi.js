
'use strict';

const global = {'a': 1};


function test() {

  // i think in strict node this is undefined is not bound?

  console.log('this:', this);
/*
  let $global;
  if(this && this.global) {
    console.log('assigning from this');
    $global = this.global;
  } else {
    console.log('assigning from global');
    $global = global;
  }
*/

  // now test trying to use same name
  // it works when bound but not when unbound. why is that
//  const $global = this && this.global ? this.global : global;

  const deps = this || {};
  const $global = deps.global || global;
  console.log('global:', $global);
}
