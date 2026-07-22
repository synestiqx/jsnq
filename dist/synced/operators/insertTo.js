import { mutationAction, normalizeModeKeyOptions } from './shared.js';
function insertTo(position, data, modeOrOpts = 'inside', key) {
    const opts = normalizeModeKeyOptions(modeOrOpts, key);
    return mutationAction({ type: 'insert_to', position, data, mode: opts.mode ?? 'inside', key: opts.key });
}
export default insertTo;
//# sourceMappingURL=insertTo.js.map