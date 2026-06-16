import { JsonOperator, PipelineLike } from '../core/types';
import { mutationAction } from './shared';

const deleteElement = <T extends PipelineLike>(): JsonOperator<T> => mutationAction({ type: 'delete_element' });

export default deleteElement;
