import { targetMatchesOperator } from './shared';

// Alias sugar for moveToMatches (first target semantics)
const moveToFirstTarget = targetMatchesOperator('move_matches');

export default moveToFirstTarget;
