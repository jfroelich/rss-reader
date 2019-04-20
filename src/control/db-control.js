import * as DBService from '/src/service/db-service.js';
import { INDEFINITE } from '/src/lib/deadline.js';

export default function DbControl() { }

DbControl.prototype.init = function () {
  chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
};

DbControl.prototype.onInstalled = async function (event) {
  if (event.reason === 'install') {
    // This is one of the earliest, if not the earliest, calls to open the database once the
    // extension is installed or updated, so we want to allow for the extra time it takes to
    // complete the upgrade, so we do not impose a timeout in this case.
    const conn = await DBService.open(INDEFINITE);
    conn.close();
  }
};
