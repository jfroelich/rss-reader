
import sprintf from "/src/experimental/sprintf.js";

window.sprintf = sprintf;


// TODO: write more tests

console.assert(sprintf() === '');
console.assert(sprintf(undefined) === 'undefined');
console.assert(sprintf(null) === 'null');

// Do things like test '%d', string

console.log('if all asserts passed, nothing before this shows up in console');
