import React from '../../../vendor/react-shim.js';
import { createRoot } from '../../../vendor/dom-shim.js';
import { App } from '../../../packages/ui/src/App.js';

const root = document.getElementById('root');
if (!root)
    throw new Error('缺少应用挂载节点');
createRoot(root).render(React.createElement(App, null));
