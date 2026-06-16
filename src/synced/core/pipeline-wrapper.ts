import JsonPipeline from './pipeline';
import { JsonOperator, JsonLike } from './types';

/**
 * Wrapper for JsonPipeline that provides auto-immutability for zoneless change detection.
 *
 * Usage:
 *   const wrapper = new PipelineWrapper(data);
 *   wrapper.pipeline(where(...), update(...)).execute();
 *   const newData = wrapper.data; // Assign back to store
 */
export class PipelineWrapper<T extends JsonLike = JsonLike> {
  private _pipeline: JsonPipeline<T>;

  constructor(data: T, options?: { autoClone?: boolean }) {
    // Auto-clone by default for immutability
    const clonedData = (options?.autoClone !== false) ? structuredClone(data) : data;
    this._pipeline = new JsonPipeline(clonedData as T);
  }

  /**
   * Apply pipeline operators
   */
  pipeline(...ops: Array<JsonOperator<JsonPipeline<T>>>): this {
    this._pipeline = ops.reduce((acc, op) => op(acc), this._pipeline);
    return this;
  }

  /**
   * Execute pipeline with optional mode
   */
  execute(mode: 'all' | 'first' | 'count' = 'all'): unknown {
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
  get data(): T {
    return this._pipeline.data;
  }

  /**
   * Get pipeline stats
   */
  get stats() {
    return this._pipeline.getStats();
  }
}
