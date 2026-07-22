import { Action, CompiledCriterion, JsonOperator, PipelineLike, PipelineStats, SearchOptions, SearchResultNode, JsonLike } from './types.js';
export declare class JsnqPipeline<TData extends JsonLike = JsonLike> implements PipelineLike<TData> {
    private _data;
    get data(): TData;
    readonly criteria: ReadonlyArray<CompiledCriterion>;
    readonly actions: ReadonlyArray<Action>;
    readonly options: Readonly<SearchOptions>;
    private readonly stats;
    private warnedUnknownOps;
    private strictCtx;
    private immutableApplied;
    private preparedActions;
    constructor(data: TData, options?: SearchOptions, criteria?: CompiledCriterion[], actions?: Action[]);
    private spawn;
    with(next: {
        data?: TData;
        options?: SearchOptions;
        criteria?: CompiledCriterion[];
        actions?: Action[];
    }): JsnqPipeline<TData>;
    immutable(mode?: true | 'auto'): JsnqPipeline<TData>;
    dryRun(enabled?: boolean): JsnqPipeline<TData>;
    pipeline(...ops: Array<JsonOperator<JsnqPipeline<TData>>>): JsnqPipeline<TData>;
    pipe(...ops: Array<JsonOperator<JsnqPipeline<TData>>>): JsnqPipeline<TData>;
    clone(): JsnqPipeline<TData>;
    first(): TData | null;
    first<T = unknown>(): T | null;
    all(): SearchResultNode<TData, unknown, string | number>[];
    count(): number;
    getStats(): PipelineStats;
    private actionsRequireMeta;
    private getPreparedActions;
    private execute;
    private executeRootArrayInsertFastPath;
    private matchesSequential;
    private markDeepResult;
    private executeSearchOnlyFastPath;
    private applyMoveOrCopy;
    private applyActions;
    private applyInsertTo;
    private applyMatchFanout;
    private applyMoveMatchesOverwrite;
    private applyGlobalActions;
}
export default JsnqPipeline;
//# sourceMappingURL=pipeline.d.ts.map