import JsnqPipeline from './pipeline.js';
import { JsonOperator, JsonLike } from './types.js';
/**
 * Wrapper for JsnqPipeline that provides auto-immutability for zoneless change detection.
 *
 * Usage:
 *   const wrapper = new PipelineWrapper(data);
 *   wrapper.pipeline(where(...), update(...)).execute();
 *   const newData = wrapper.data; // Assign back to store
 */
export declare class PipelineWrapper<T extends JsonLike = JsonLike> {
    private _pipeline;
    constructor(data: T, options?: {
        autoClone?: boolean;
        trackOperations?: boolean;
    });
    /**
     * Apply pipeline operators
     */
    pipeline(...ops: Array<JsonOperator<JsnqPipeline<T>>>): this;
    /**
     * Execute pipeline with optional mode
     */
    execute(mode?: 'all' | 'first' | 'count'): unknown;
    /**
     * Get the mutated data (cloned if autoClone was true)
     */
    get data(): T;
    /**
     * Get pipeline stats
     */
    get stats(): import("./types").PipelineStats;
}
//# sourceMappingURL=pipeline-wrapper.d.ts.map