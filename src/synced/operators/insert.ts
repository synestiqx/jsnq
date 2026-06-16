import { InsertPosition, JsonOperator, PipelineLike } from '../core/types';
import { mutationAction } from './shared';

type InsertOptions = { key?: string | number };

const insert = <T extends PipelineLike>(data: unknown, position: InsertPosition = 'inside', keyOrOpts?: string | number | InsertOptions): JsonOperator<T> => {
  const key = typeof keyOrOpts === 'object' && keyOrOpts !== null
    ? (keyOrOpts as InsertOptions).key
    : (keyOrOpts as string | number | undefined);
  return mutationAction({ type: 'insert', data, position, key });
};

export default insert;
