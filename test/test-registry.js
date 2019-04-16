// NOTE: a Set would be more appropriate but just complicate things
const testFunctions = [];

function registerTest(testFunction) {
  if (typeof testFunction !== 'function') {
    throw new TypeError(`Test function is not a function: ${testFunction}`);
  }

  if (!testFunction.name) {
    throw new TypeError('Test function must have a name (no anonymous functions)');
  }

  if (testFunctions.includes(testFunction)) {
    console.warn('Ignoring duplicate test function registration:', testFunction.name);
    return;
  }

  testFunctions.push(testFunction);
}

function getTests() {
  return testFunctions;
}

function findTestByName(name) {
  for (const testFunction of testFunctions) {
    if (testFunction.name === name) {
      return testFunction;
    }
  }

  return undefined;
}

export default {
  findTestByName,
  getTests,
  registerTest
};
