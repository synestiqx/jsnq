import { JsonOperator, PipelineLike, Path, BracketPath, JsonLike } from '../core/types.js';
declare function deleteKey<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P): JsonOperator<T>;
declare function deleteKey<T extends PipelineLike<JsonLike>>(key: string): JsonOperator<T>;
export default deleteKey;
//# sourceMappingURL=deleteKey.d.ts.map