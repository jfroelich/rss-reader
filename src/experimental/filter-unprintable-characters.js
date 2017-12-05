
// TODO: eventually move to utils
// TODO: look into how much this overlaps with filterControls

// TODO: this time, before adopting, write tests, and prove the tests work

export default function main(value) {
  if(typeof value === 'string') {

    // \t is \????? which is base10 9
    // \f is \u000c which is base10 12
    // \r is \u000d which is base10 13

    // Ok, it filters 1-8, 10-11. Now filter 14-whatever

    return value.replace(/[\u0000-\u0008\u000a-\u000b]/g, '');


  }

  return value;
}
