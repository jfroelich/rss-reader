import archive_entries_command from '/src/commands/archive-entries-command.js';
import clear_alarms_command from '/src/commands/clear-alarms-command.js';
import clear_favicons_command from '/src/commands/clear-favicons-command.js';
import compact_favicons_command from '/src/commands/compact-favicons-command.js';
import create_alarms_command from '/src/commands/create-alarms-command.js';
import install_fonts_command from '/src/commands/install-fonts-command.js';
import lookup_favicon_command from '/src/commands/lookup-favicon-command.js';
import poll_feeds_command from '/src/commands/poll-feeds-command.js';
import print_alarms_command from '/src/commands/print-alarms-command.js';
import refresh_favicons_command from '/src/commands/refresh-favicons-command.js';
import subscribe_command from '/src/commands/subscribe-command.js';
import unsubscribe_command from '/src/commands/unsubscribe-command.js';

// This module exposes various functions, known as commands, to the browser
// console. This only works if the window global variable is defined.


const commands = {};
commands.archive_entries = archive_entries_command;
commands.clear_alarms = clear_alarms_command;
commands.clear_favicons = clear_favicons_command;
commands.compact_favicons = compact_favicons_command;
commands.create_alarms = create_alarms_command;
commands.install_fonts = install_fonts_command;
commands.lookup_favicon = lookup_favicon_command;
commands.poll_feeds = poll_feeds_command;
commands.print_alarms = print_alarms_command;
commands.refresh_favicons = refresh_favicons_command;
commands.subscribe = subscribe_command;
commands.unsubscribe = unsubscribe_command;

// This is the best way to expose in console
window.cli = commands;
