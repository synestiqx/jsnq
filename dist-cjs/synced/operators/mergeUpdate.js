"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
const mergeUpdate = (key, patch, opts) => (0, shared_1.mutationAction)({ type: 'merge_update', key, patch, deep: opts?.deep });
exports.default = mergeUpdate;
//# sourceMappingURL=mergeUpdate.js.map