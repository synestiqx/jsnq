"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
const impl = (0, shared_1.positionOperator)('move');
function moveTo(position, modeOrOpts = 'inside', key) {
    return impl(position, modeOrOpts, key);
}
exports.default = moveTo;
//# sourceMappingURL=moveTo.js.map