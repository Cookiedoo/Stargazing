import { ScreenManager } from './screens/ScreenManager.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { PROTOCOL_VERSION } from '@stargazing/shared';

console.log(`Stargaze client booting. Protocol v${PROTOCOL_VERSION}`);

const root = document.getElementById('app');
if (!root) throw new Error('No #app element');

const manager = new ScreenManager(root);
manager.go(new TitleScreen(manager));