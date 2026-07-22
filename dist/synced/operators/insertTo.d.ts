import { InsertPosition, JsonOperator, PipelineLike, Path, PathValue, KeyFor, BracketPath, JsonLike } from '../core/types.js';
import { ModeKeyOptions } from './shared.js';
type InsertToOptions = ModeKeyOptions;
declare function insertTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, data: unknown, mode?: InsertPosition, key?: KeyFor<PathValue<T['data'], P & string>>): JsonOperator<T>;
declare function insertTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, data: unknown, opts: {
    mode?: InsertPosition;
    key?: KeyFor<PathValue<T['data'], P & string>>;
}): JsonOperator<T>;
declare function insertTo<T extends PipelineLike>(position: string, data: unknown, modeOrOpts?: InsertPosition | InsertToOptions, key?: string | number): JsonOperator<T>;
export default insertTo;
//# sourceMappingURL=insertTo.d.ts.map