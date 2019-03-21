import * as cron from '/src/cron.js';

export default function create_alarms_command() {
  console.log('Creating alarms...');

  cron.create_alarms();

  console.log('Created alarms');
}
