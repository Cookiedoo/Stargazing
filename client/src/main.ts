import { ScreenManager } from './screens/ScreenManager.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { PROTOCOL_VERSION } from '@stargazing/shared';
import { session } from './account/Session.js';

console.log(`Stargaze client booting. Protocol v${PROTOCOL_VERSION}`);

const root = document.getElementById('app');
if (!root) throw new Error('No #app element');

session.boot();

const manager = new ScreenManager(root);
manager.go(new TitleScreen(manager));