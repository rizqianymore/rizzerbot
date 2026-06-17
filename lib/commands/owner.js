import { groupCommands } from './group.js';
import { channelCommands } from './channel.js';
import { secureCommands } from './secure.js';
import { managementCommands } from './management.js';

export const ownerCommands = [
    ...groupCommands,
    ...channelCommands,
    ...secureCommands,
    ...managementCommands
];
