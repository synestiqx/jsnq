import { CompiledCriterion, JsonOperator, PipelineLike, Path, PathValue, OperatorFor, BracketPath, JsonLike } from '../core/types.js';
declare function where<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P, operator: OperatorFor<PathValue<T['data'], P & string>>, value: PathValue<T['data'], P & string>): JsonOperator<T>;
declare function where<T extends PipelineLike<JsonLike>, P extends Path<T['data']> | BracketPath<T['data']>>(key: P, operator: 'isArray' | 'isObject', value: boolean): JsonOperator<T>;
declare function where<T extends PipelineLike<JsonLike>>(key: string, operator: CompiledCriterion['operator'], value: unknown): JsonOperator<T>;
export default where;
//# sourceMappingURL=where.d.ts.map