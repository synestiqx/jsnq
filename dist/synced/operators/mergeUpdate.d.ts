import { JsonOperator, PipelineLike } from '../core/types.js';
type MergeUpdateOptions = {
    deep?: boolean;
};
declare const mergeUpdate: <T extends PipelineLike>(key: string, patch: Record<string, unknown>, opts?: MergeUpdateOptions) => JsonOperator<T>;
export default mergeUpdate;
//# sourceMappingURL=mergeUpdate.d.ts.map