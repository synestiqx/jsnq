import { Action, ActionType, ComparisonOperator, InsertPosition, JsonOperator, PipelineLike } from '../core/types.js';
export type ModeKeyOptions<TKey extends string | number = string | number> = {
    mode?: InsertPosition;
    key?: TKey;
};
export declare const normalizeModeKeyOptions: <TKey extends string | number>(modeOrOpts: InsertPosition | ModeKeyOptions<TKey> | undefined, fallbackKey?: TKey) => ModeKeyOptions<TKey>;
export declare const appendAction: <T extends PipelineLike, TAction extends Action>(pipeline: T, action: TAction) => T;
/** Wrap an action as a pipeline operator flagged as a mutation. */
export declare const mutationAction: <T extends PipelineLike>(action: Action) => JsonOperator<T>;
/**
 * Factory for the move/copy "matches" operator family: all six operators share
 * the (targetKey, targetOperator, targetValue, mode?, key?) signature and only
 * differ in the produced action type and the default mode.
 */
export declare const targetMatchesOperator: (type: ActionType, defaultMode?: InsertPosition) => <T extends PipelineLike>(targetKey: string, targetOperator: ComparisonOperator, targetValue: unknown, mode?: InsertPosition | undefined, key?: string | number) => JsonOperator<T>;
/**
 * Factory for moveTo/copyTo: (position, modeOrOpts?, key?) with options-object
 * support; differs only in action type.
 */
export declare const positionOperator: (type: "move" | "copy") => <T extends PipelineLike>(position: string, modeOrOpts?: InsertPosition | ModeKeyOptions, key?: string | number) => JsonOperator<T>;
//# sourceMappingURL=shared.d.ts.map