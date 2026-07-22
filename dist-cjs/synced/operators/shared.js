"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionOperator = exports.targetMatchesOperator = exports.mutationAction = exports.appendAction = exports.normalizeModeKeyOptions = void 0;
const normalizeModeKeyOptions = (modeOrOpts, fallbackKey) => {
    if (typeof modeOrOpts === 'object' && modeOrOpts !== null) {
        return modeOrOpts;
    }
    const mode = modeOrOpts;
    return { mode, key: fallbackKey };
};
exports.normalizeModeKeyOptions = normalizeModeKeyOptions;
const appendAction = (pipeline, action) => pipeline.with({ actions: [...pipeline.actions, action] });
exports.appendAction = appendAction;
/** Wrap an action as a pipeline operator flagged as a mutation. */
const mutationAction = (action) => {
    const operator = (pipeline) => (0, exports.appendAction)(pipeline, action);
    operator.__isMutation = true;
    return operator;
};
exports.mutationAction = mutationAction;
/**
 * Factory for the move/copy "matches" operator family: all six operators share
 * the (targetKey, targetOperator, targetValue, mode?, key?) signature and only
 * differ in the produced action type and the default mode.
 */
const targetMatchesOperator = (type, defaultMode) => (targetKey, targetOperator, targetValue, mode = defaultMode, key) => (0, exports.mutationAction)({ type, targetKey, targetOperator, targetValue, mode, key });
exports.targetMatchesOperator = targetMatchesOperator;
/**
 * Factory for moveTo/copyTo: (position, modeOrOpts?, key?) with options-object
 * support; differs only in action type.
 */
const positionOperator = (type) => (position, modeOrOpts = 'inside', key) => {
    const opts = (0, exports.normalizeModeKeyOptions)(modeOrOpts, key);
    return (0, exports.mutationAction)({ type, position, mode: opts.mode ?? 'inside', key: opts.key });
};
exports.positionOperator = positionOperator;
//# sourceMappingURL=shared.js.map