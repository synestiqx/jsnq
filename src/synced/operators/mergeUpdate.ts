import { JsonOperator, PipelineLike } from '../core/types';
import { mutationAction } from './shared';

type MergeUpdateOptions = { deep?: boolean };

const mergeUpdate = <T extends PipelineLike>(key: string, patch: Record<string, unknown>, opts?: MergeUpdateOptions): JsonOperator<T> =>
  mutationAction({ type: 'merge_update', key, patch, deep: opts?.deep });

export default mergeUpdate;
