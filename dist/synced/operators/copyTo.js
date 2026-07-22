import { positionOperator } from './shared.js';
const impl = positionOperator('copy');
function copyTo(position, modeOrOpts = 'inside', key) {
    return impl(position, modeOrOpts, key);
}
export default copyTo;
//# sourceMappingURL=copyTo.js.map