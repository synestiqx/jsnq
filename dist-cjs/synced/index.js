"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyToFirstTarget = exports.moveToFirstTarget = exports.copyToAll = exports.moveToAll = exports.copyToMatches = exports.copyTo = exports.moveToMatchesOverwrite = exports.moveToMatches = exports.insertTo = exports.moveTo = exports.insert = exports.deleteElement = exports.deleteKey = exports.mergeUpdate = exports.update = exports.replace = exports.where = exports.collectPipelineIntent = exports.isDeepSugarAction = exports.applyDeepSugarPatch = exports.applyInsertToInsideArrayCow = exports.tryFastStructuralMutation = exports.tryFastPipelineMutation = exports.buildPath = exports.setPathCacheLimit = exports.registerOperator = exports.PipelineWrapper = exports.JsnqPipeline = void 0;
var pipeline_1 = require("./core/pipeline");
Object.defineProperty(exports, "JsnqPipeline", { enumerable: true, get: function () { return __importDefault(pipeline_1).default; } });
var pipeline_wrapper_1 = require("./core/pipeline-wrapper");
Object.defineProperty(exports, "PipelineWrapper", { enumerable: true, get: function () { return pipeline_wrapper_1.PipelineWrapper; } });
__exportStar(require("./core/types"), exports);
__exportStar(require("./core/data-engine"), exports);
var operators_registry_1 = require("./core/operators-registry");
Object.defineProperty(exports, "registerOperator", { enumerable: true, get: function () { return operators_registry_1.registerOperator; } });
var utils_1 = require("./core/utils");
Object.defineProperty(exports, "setPathCacheLimit", { enumerable: true, get: function () { return utils_1.setPathCacheLimit; } });
Object.defineProperty(exports, "buildPath", { enumerable: true, get: function () { return utils_1.buildPath; } });
var pipeline_fastpath_1 = require("./core/pipeline-fastpath");
Object.defineProperty(exports, "tryFastPipelineMutation", { enumerable: true, get: function () { return pipeline_fastpath_1.tryFastPipelineMutation; } });
Object.defineProperty(exports, "tryFastStructuralMutation", { enumerable: true, get: function () { return pipeline_fastpath_1.tryFastStructuralMutation; } });
Object.defineProperty(exports, "applyInsertToInsideArrayCow", { enumerable: true, get: function () { return pipeline_fastpath_1.applyInsertToInsideArrayCow; } });
Object.defineProperty(exports, "applyDeepSugarPatch", { enumerable: true, get: function () { return pipeline_fastpath_1.applyDeepSugarPatch; } });
Object.defineProperty(exports, "isDeepSugarAction", { enumerable: true, get: function () { return pipeline_fastpath_1.isDeepSugarAction; } });
Object.defineProperty(exports, "collectPipelineIntent", { enumerable: true, get: function () { return pipeline_fastpath_1.collectPipelineIntent; } });
var where_1 = require("./operators/where");
Object.defineProperty(exports, "where", { enumerable: true, get: function () { return __importDefault(where_1).default; } });
var replace_1 = require("./operators/replace");
Object.defineProperty(exports, "replace", { enumerable: true, get: function () { return __importDefault(replace_1).default; } });
var update_1 = require("./operators/update");
Object.defineProperty(exports, "update", { enumerable: true, get: function () { return __importDefault(update_1).default; } });
var mergeUpdate_1 = require("./operators/mergeUpdate");
Object.defineProperty(exports, "mergeUpdate", { enumerable: true, get: function () { return __importDefault(mergeUpdate_1).default; } });
var deleteKey_1 = require("./operators/deleteKey");
Object.defineProperty(exports, "deleteKey", { enumerable: true, get: function () { return __importDefault(deleteKey_1).default; } });
var deleteElement_1 = require("./operators/deleteElement");
Object.defineProperty(exports, "deleteElement", { enumerable: true, get: function () { return __importDefault(deleteElement_1).default; } });
var insert_1 = require("./operators/insert");
Object.defineProperty(exports, "insert", { enumerable: true, get: function () { return __importDefault(insert_1).default; } });
var moveTo_1 = require("./operators/moveTo");
Object.defineProperty(exports, "moveTo", { enumerable: true, get: function () { return __importDefault(moveTo_1).default; } });
var insertTo_1 = require("./operators/insertTo");
Object.defineProperty(exports, "insertTo", { enumerable: true, get: function () { return __importDefault(insertTo_1).default; } });
var moveToMatches_1 = require("./operators/moveToMatches");
Object.defineProperty(exports, "moveToMatches", { enumerable: true, get: function () { return __importDefault(moveToMatches_1).default; } });
var moveToMatchesOverwrite_1 = require("./operators/moveToMatchesOverwrite");
Object.defineProperty(exports, "moveToMatchesOverwrite", { enumerable: true, get: function () { return __importDefault(moveToMatchesOverwrite_1).default; } });
var copyTo_1 = require("./operators/copyTo");
Object.defineProperty(exports, "copyTo", { enumerable: true, get: function () { return __importDefault(copyTo_1).default; } });
var copyToMatches_1 = require("./operators/copyToMatches");
Object.defineProperty(exports, "copyToMatches", { enumerable: true, get: function () { return __importDefault(copyToMatches_1).default; } });
var moveToAll_1 = require("./operators/moveToAll");
Object.defineProperty(exports, "moveToAll", { enumerable: true, get: function () { return __importDefault(moveToAll_1).default; } });
var copyToAll_1 = require("./operators/copyToAll");
Object.defineProperty(exports, "copyToAll", { enumerable: true, get: function () { return __importDefault(copyToAll_1).default; } });
var moveToFirstTarget_1 = require("./operators/moveToFirstTarget");
Object.defineProperty(exports, "moveToFirstTarget", { enumerable: true, get: function () { return __importDefault(moveToFirstTarget_1).default; } });
var copyToFirstTarget_1 = require("./operators/copyToFirstTarget");
Object.defineProperty(exports, "copyToFirstTarget", { enumerable: true, get: function () { return __importDefault(copyToFirstTarget_1).default; } });
//# sourceMappingURL=index.js.map