
// import net/url-utils.js

function test() {
  const input = 'http://www.cse.unsw.edu.au/~hpaik/thesis/showcases/16s2/scott_brisbane.pdf';
  const result = URLUtils.sniffIsBinary(new URL(input));
  console.assert(result === true, 'failed:', input);
}
