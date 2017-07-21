

function test() {
  
}




function testBlockscope() {
  // Test blocked scoped variable leak
  // NOTE: this works as expected, throws ReferenceError
  try {
    console.log('Ancestor map?', ancestorBiasMap);
  } catch(error) {
    console.log(error);
  }

  // Test blocked scope function leak
  // NOTE: this works as expected, throws ReferenceError
  try {
    console.log('Function?', deriveTextBias);
  } catch(error) {
    console.log(error);
  }

}
