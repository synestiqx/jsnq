import { mutationAction } from './shared.js';
function update(key, value) {
    return mutationAction({ type: 'update', key, value });
}
export default update;
//# sourceMappingURL=update.js.map