"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("./shared");
const moveToMatchesOverwrite = (targetKey, targetOperator, targetValue, overwriteKey) => (0, shared_1.mutationAction)({ type: 'move_matches_overwrite', targetKey, targetOperator, targetValue, overwriteKey });
exports.default = moveToMatchesOverwrite;
//# sourceMappingURL=moveToMatchesOverwrite.js.map