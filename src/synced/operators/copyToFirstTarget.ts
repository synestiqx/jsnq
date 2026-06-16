import { targetMatchesOperator } from './shared';

// Alias sugar for copyToMatches (first target semantics)
const copyToFirstTarget = targetMatchesOperator('copy_matches');

export default copyToFirstTarget;
