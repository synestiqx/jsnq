import { InsertPosition, JsonOperator, PipelineLike, Path, PathValue, KeyFor, BracketPath, JsonLike } from '../core/types.js';
import { ModeKeyOptions } from './shared.js';
type MoveToOptions = ModeKeyOptions;
declare function moveTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, mode?: InsertPosition, key?: KeyFor<PathValue<T['data'], P & string>>): JsonOperator<T>;
declare function moveTo<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(position: P, opts: {
    mode?: InsertPosition;
    key?: KeyFor<PathValue<T['data'], P & string>>;
}): JsonOperator<T>;
declare function moveTo<T extends PipelineLike>(position: string, modeOrOpts?: InsertPosition | MoveToOptions, key?: string | number): JsonOperator<T>;
export default moveTo;
//# sourceMappingURL=moveTo.d.ts.map