// Rule 10.3 of airbnb style guide says we should not use the export one-liner

import { ConstraintError, NotFoundError } from '/src/db/errors.js';
import {
  getURL, getURLString, hasURL, isValidId, setURL
} from '/src/db/resource-utils.js';
import Connection from '/src/db/connection.js';
import countResources from '/src/db/count-resources.js';
import createResource from '/src/db/create-resource.js';
import deleteResource from '/src/db/delete-resource.js';
import getResource from '/src/db/get-resource.js';
import getResources from '/src/db/get-resources.js';
import open, { defaultUpgradeNeededHandler, defaultVersion } from '/src/db/open.js';
import patchResource from '/src/db/patch-resource.js';
import putResource from '/src/db/put-resource.js';

export { countResources };
export { createResource };
export { deleteResource };
export { getResource };
export { getResources };
export { getURL };
export { getURLString };
export { hasURL };
export { isValidId };
export { open };
export { defaultUpgradeNeededHandler };
export { defaultVersion };
export { patchResource };
export { putResource };
export { setURL };
export { Connection };
export { ConstraintError };
export { NotFoundError };
