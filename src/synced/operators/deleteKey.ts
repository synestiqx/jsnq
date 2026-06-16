import { DeleteKeyAction, JsonOperator, PipelineLike, Path, BracketPath, JsonLike } from '../core/types';
import { mutationAction } from './shared';

function deleteKey<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P): JsonOperator<T>;
function deleteKey<T extends PipelineLike<JsonLike>>(key: string): JsonOperator<T>;
function deleteKey<T extends PipelineLike<JsonLike>>(key: string): JsonOperator<T> {
  return mutationAction<T>({ type: 'delete_key', key } satisfies DeleteKeyAction);
}

export default deleteKey;
