import { isExplicitConfirmation } from './confirmation.mjs';
import { createSession } from './session.mjs';
import { registerTools } from './tools.mjs';
import { registerCommand } from './command.mjs';
import { registerEvents } from './events.mjs';

export { isExplicitConfirmation };

export function registerSurgicalLoop(pi) {
  const session = createSession(pi);
  registerTools(pi, session);
  registerCommand(pi, session);
  registerEvents(pi, session);
}
