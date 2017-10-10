console.log('Printed from test-es6modules.js Hello!');

import {test} from "test-es6modules-include.js";

console.log('Imported test:', test);

export default test;
