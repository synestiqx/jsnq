import { mutationAction } from './shared.js';
function deleteKey(key) {
    return mutationAction({ type: 'delete_key', key });
}
export default deleteKey;
//# sourceMappingURL=deleteKey.js.map