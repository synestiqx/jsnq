import { mutationAction } from './shared.js';
const mergeUpdate = (key, patch, opts) => mutationAction({ type: 'merge_update', key, patch, deep: opts?.deep });
export default mergeUpdate;
//# sourceMappingURL=mergeUpdate.js.map