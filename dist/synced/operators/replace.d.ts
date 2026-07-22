import { JsonOperator, PipelineLike, ReplaceAction, Path, PathValue, BracketPath, JsonLike } from '../core/types.js';
declare function replace<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P, value: PathValue<T['data'], P & string> | ((current: PathValue<T['data'], P & string>, node: T['data']) => PathValue<T['data'], P & string>)): JsonOperator<T>;
declare function replace<T extends PipelineLike<JsonLike>>(key: string, value: ReplaceAction['value']): JsonOperator<T>;
export default replace;
//# sourceMappingURL=replace.d.ts.map