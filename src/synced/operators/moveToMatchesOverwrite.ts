import { JsonOperator, MoveMatchesOverwriteAction, PipelineLike } from '../core/types';
import { mutationAction } from './shared';

const moveToMatchesOverwrite = <T extends PipelineLike>(
  targetKey: string,
  targetOperator: MoveMatchesOverwriteAction['targetOperator'],
  targetValue: unknown,
  overwriteKey: string
): JsonOperator<T> =>
  mutationAction({ type: 'move_matches_overwrite', targetKey, targetOperator, targetValue, overwriteKey });

export default moveToMatchesOverwrite;
