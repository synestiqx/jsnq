import { positionOperator } from './shared.js';
const impl = positionOperator('move');
function moveTo(position, modeOrOpts = 'inside', key) {
    return impl(position, modeOrOpts, key);
}
export default moveTo;
//# sourceMappingURL=moveTo.js.map