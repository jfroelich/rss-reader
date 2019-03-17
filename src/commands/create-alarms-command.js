import * as cron from '/src/cron.js';

export default function create_alarms_command() {
  console.debug('Creating alarms...');
  cron.create_alarms();
  console.log('Created alarms');
}
