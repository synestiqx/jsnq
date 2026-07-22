import { JsonOperator, MoveMatchesOverwriteAction, PipelineLike } from '../core/types.js';
declare const moveToMatchesOverwrite: <T extends PipelineLike>(targetKey: string, targetOperator: MoveMatchesOverwriteAction["targetOperator"], targetValue: unknown, overwriteKey: string) => JsonOperator<T>;
export default moveToMatchesOverwrite;
//# sourceMappingURL=moveToMatchesOverwrite.d.ts.map