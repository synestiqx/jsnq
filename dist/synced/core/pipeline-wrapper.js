import JsnqPipeline from './pipeline.js';
import { cloneJsonData } from './data-engine.js';
/**
 * Wrapper for JsnqPipeline that provides auto-immutability for zoneless change detection.
 *
 * Usage:
 *   const wrapper = new PipelineWrapper(data);
 *   wrapper.pipeline(where(...), update(...)).execute();
 *   const newData = wrapper.data; // Assign back to store
 */
export class PipelineWrapper {
    _pipeline;
    constructor(data, options) {
        // Auto-clone by default for immutability
        const clonedData = (options?.autoClone !== false) ? cloneJsonData(data) : data;
        this._pipeline = new JsnqPipeline(clonedData, {
            trackOperations: options?.trackOperations ?? true,
        });
    }
    /**
     * Apply pipeline operators
     */
    pipeline(...ops) {
        this._pipeline = ops.reduce((acc, op) => op(acc), this._pipeline);
        return this;
    }
    /**
     * Execute pipeline with optional mode
     */
    execute(mode = 'all') {
        switch (mode) {
            case 'first':
                return this._pipeline.first();
            case 'count':
                return this._pipeline.count();
            case 'all':
            default:
                return this._pipeline.all();
        }
    }
    /**
     * Get the mutated data (cloned if autoClone was true)
     */
    get data() {
        return this._pipeline.data;
    }
    /**
     * Get pipeline stats
     */
    get stats() {
        return this._pipeline.getStats();
    }
}
//# sourceMappingURL=pipeline-wrapper.js.map