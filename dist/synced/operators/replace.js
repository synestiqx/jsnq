import { mutationAction } from './shared.js';
function replace(key, value) {
    return mutationAction({ type: 'replace', key, value });
}
export default replace;
//# sourceMappingURL=replace.js.map