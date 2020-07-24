import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import changeGeneSelection from '../../../../redux/actions/genes/changeGeneSelection';
import initialState from '../../../../redux/reducers/genesReducer/initialState';

import { GENES_SELECT, GENES_DESELECT } from '../../../../redux/actionTypes/genes';

const mockStore = configureStore([thunk]);

const experimentId = '1234';
const genes = ['a', 'b', 'c', 'd'];

describe('changeGeneSelection action', () => {
  it('Dispatches select event when select event specified', async () => {
    const store = mockStore(initialState);
    store.dispatch(changeGeneSelection(experimentId, genes, 'select'));

    const firstAction = store.getActions()[0];
    expect(firstAction.type).toEqual(GENES_SELECT);
    expect(firstAction).toMatchSnapshot();
  });

  it('Dispatches deselect event when select event specified', async () => {
    const store = mockStore(initialState);
    store.dispatch(changeGeneSelection(experimentId, genes, 'deselect'));

    const firstAction = store.getActions()[0];
    expect(firstAction.type).toEqual(GENES_DESELECT);
    expect(firstAction).toMatchSnapshot();
  });

  it('Does not dispatch on other choice', async () => {
    const store = mockStore(initialState);
    store.dispatch(changeGeneSelection(experimentId, genes, 'maybeselect'));

    expect(store.getActions().length).toEqual(0);
  });
});
