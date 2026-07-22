"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
function replace(key, value) {
    return (0, shared_1.mutationAction)({ type: 'replace', key, value });
}
exports.default = replace;
//# sourceMappingURL=replace.js.map