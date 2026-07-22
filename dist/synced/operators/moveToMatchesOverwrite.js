import { mutationAction } from './shared.js';
const moveToMatchesOverwrite = (targetKey, targetOperator, targetValue, overwriteKey) => mutationAction({ type: 'move_matches_overwrite', targetKey, targetOperator, targetValue, overwriteKey });
export default moveToMatchesOverwrite;
//# sourceMappingURL=moveToMatchesOverwrite.js.map