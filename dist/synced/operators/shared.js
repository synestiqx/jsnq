export const normalizeModeKeyOptions = (modeOrOpts, fallbackKey) => {
    if (typeof modeOrOpts === 'object' && modeOrOpts !== null) {
        return modeOrOpts;
    }
    const mode = modeOrOpts;
    return { mode, key: fallbackKey };
};
export const appendAction = (pipeline, action) => pipeline.with({ actions: [...pipeline.actions, action] });
/** Wrap an action as a pipeline operator flagged as a mutation. */
export const mutationAction = (action) => {
    const operator = (pipeline) => appendAction(pipeline, action);
    operator.__isMutation = true;
    return operator;
};
/**
 * Factory for the move/copy "matches" operator family: all six operators share
 * the (targetKey, targetOperator, targetValue, mode?, key?) signature and only
 * differ in the produced action type and the default mode.
 */
export const targetMatchesOperator = (type, defaultMode) => (targetKey, targetOperator, targetValue, mode = defaultMode, key) => mutationAction({ type, targetKey, targetOperator, targetValue, mode, key });
/**
 * Factory for moveTo/copyTo: (position, modeOrOpts?, key?) with options-object
 * support; differs only in action type.
 */
export const positionOperator = (type) => (position, modeOrOpts = 'inside', key) => {
    const opts = normalizeModeKeyOptions(modeOrOpts, key);
    return mutationAction({ type, position, mode: opts.mode ?? 'inside', key: opts.key });
};
//# sourceMappingURL=shared.js.map