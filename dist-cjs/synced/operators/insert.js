"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
const insert = (data, position = 'inside', keyOrOpts) => {
    const key = typeof keyOrOpts === 'object' && keyOrOpts !== null
        ? keyOrOpts.key
        : keyOrOpts;
    return (0, shared_1.mutationAction)({ type: 'insert', data, position, key });
};
exports.default = insert;
//# sourceMappingURL=insert.js.map