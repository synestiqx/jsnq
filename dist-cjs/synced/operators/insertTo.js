"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
function insertTo(position, data, modeOrOpts = 'inside', key) {
    const opts = (0, shared_1.normalizeModeKeyOptions)(modeOrOpts, key);
    return (0, shared_1.mutationAction)({ type: 'insert_to', position, data, mode: opts.mode ?? 'inside', key: opts.key });
}
exports.default = insertTo;
//# sourceMappingURL=insertTo.js.map