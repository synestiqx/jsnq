"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
function update(key, value) {
    return (0, shared_1.mutationAction)({ type: 'update', key, value });
}
exports.default = update;
//# sourceMappingURL=update.js.map