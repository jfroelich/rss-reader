

function testParseHTML(inputString) {
  const tokenArray = parseHTML(inputString);
  for(let token of tokenArray) {
    console.log('TOKEN:', token);
  }
}
