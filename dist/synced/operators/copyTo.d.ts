import { InsertPosition, JsonOperator, PipelineLike, Path, PathValue, KeyFor, BracketPath, JsonLike } from '../core/types.js';
import { ModeKeyOptions } from './shared.js';
type CopyToOptions = ModeKeyOptions;
declare function copyTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, mode?: InsertPosition, key?: KeyFor<PathValue<T['data'], P & string>>): JsonOperator<T>;
declare function copyTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, opts: {
    mode?: InsertPosition;
    key?: KeyFor<PathValue<T['data'], P & string>>;
}): JsonOperator<T>;
declare function copyTo<T extends PipelineLike>(position: string, modeOrOpts?: InsertPosition | CopyToOptions, key?: string | number): JsonOperator<T>;
export default copyTo;
//# sourceMappingURL=copyTo.d.ts.map