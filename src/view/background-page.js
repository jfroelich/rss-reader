import BrowserActionControl from '/src/control/browser-action-control.js';
import ConfigControl from '/src/control/config-control.js';
import CronControl from '/src/control/cron-control.js';
import DbControl from '/src/control/db-control.js';

const configControl = new ConfigControl();
configControl.init(true);

const dbControl = new DbControl();
dbControl.init();

const browserActionControl = new BrowserActionControl();
browserActionControl.init(true, true, true);

const cronControl = new CronControl();
cronControl.init();
