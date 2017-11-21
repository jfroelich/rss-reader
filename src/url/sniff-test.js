import assert from "/src/assert.js";
import sniffIsBinaryURL from "/src/url/sniff.js";

// TODO: get the test working again, it fell behind when refactoring to modules
// TODO: add data uri test

const input = 'http://www.cse.unsw.edu.au/~hpaik/thesis/showcases/16s2/scott_brisbane.pdf';
const result = sniffIsBinaryURL(new URL(input));
assert(result === true, input);
