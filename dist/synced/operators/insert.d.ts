import { InsertPosition, JsonOperator, PipelineLike } from '../core/types.js';
type InsertOptions = {
    key?: string | number;
};
declare const insert: <T extends PipelineLike>(data: unknown, position?: InsertPosition, keyOrOpts?: string | number | InsertOptions) => JsonOperator<T>;
export default insert;
//# sourceMappingURL=insert.d.ts.map