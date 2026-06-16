import { InsertPosition, JsonOperator, PipelineLike, Path, PathValue, KeyFor, BracketPath, JsonLike } from '../core/types';
import { ModeKeyOptions, positionOperator } from './shared';

type CopyToOptions = ModeKeyOptions;
const impl = positionOperator('copy');

// Strongly-typed overload (restrict key type by target path value)
function copyTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, mode?: InsertPosition, key?: KeyFor<PathValue<T['data'], P & string>>): JsonOperator<T>;
function copyTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, opts: { mode?: InsertPosition; key?: KeyFor<PathValue<T['data'], P & string>> }): JsonOperator<T>;
// General signature (back-compat)
function copyTo<T extends PipelineLike>(position: string, modeOrOpts?: InsertPosition | CopyToOptions, key?: string | number): JsonOperator<T>;
function copyTo<T extends PipelineLike>(position: string, modeOrOpts: InsertPosition | CopyToOptions = 'inside', key?: string | number): JsonOperator<T> {
  return impl(position, modeOrOpts, key);
}

export default copyTo;
