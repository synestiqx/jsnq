import { mutationAction } from './shared.js';
const insert = (data, position = 'inside', keyOrOpts) => {
    const key = typeof keyOrOpts === 'object' && keyOrOpts !== null
        ? keyOrOpts.key
        : keyOrOpts;
    return mutationAction({ type: 'insert', data, position, key });
};
export default insert;
//# sourceMappingURL=insert.js.map