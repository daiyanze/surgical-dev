import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerSurgicalLoop } from '../extension.mjs';

export default function surgicalDev(pi: ExtensionAPI) {
  registerSurgicalLoop(pi);
}
