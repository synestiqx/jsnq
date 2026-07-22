import { JsonOperator, PipelineLike, UpdateAction, Path, PathValue, BracketPath, JsonLike } from '../core/types.js';
declare function update<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P, value: PathValue<T['data'], P & string> | ((current: PathValue<T['data'], P & string>, node: T['data']) => PathValue<T['data'], P & string>)): JsonOperator<T>;
declare function update<T extends PipelineLike<JsonLike>>(key: string, value: UpdateAction['value']): JsonOperator<T>;
export default update;
//# sourceMappingURL=update.d.ts.map