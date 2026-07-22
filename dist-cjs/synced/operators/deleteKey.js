"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
function deleteKey(key) {
    return (0, shared_1.mutationAction)({ type: 'delete_key', key });
}
exports.default = deleteKey;
//# sourceMappingURL=deleteKey.js.map