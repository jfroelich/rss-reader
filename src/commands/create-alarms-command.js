import * as cron_control from '/src/cron.js';

export default function create_alarms_command() {
  console.debug('Creating alarms...');
  cron_control.create_alarms();
  console.log('Created alarms');
}
