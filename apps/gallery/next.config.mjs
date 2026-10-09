import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default {agentRules:false,turbopack:{root},outputFileTracingRoot:root,devIndicators:false};
