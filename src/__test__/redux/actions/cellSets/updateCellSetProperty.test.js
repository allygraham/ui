import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import waitForActions from 'redux-mock-store-await-actions';

import config from 'config';
import { api } from 'utils/constants';

import updateCellSetProperty from 'redux/actions/cellSets/updateCellSetProperty';

import { CELL_SETS_UPDATE_PROPERTY } from 'redux/actionTypes/cellSets';
import initialState from 'redux/reducers/cellSets/initialState';

import '__test__/test-utils/setupTests';

enableFetchMocks();

jest.mock('config');

const mockStore = configureStore([thunk]);

describe('updateCellSetProperty action', () => {
  const experimentId = '1234';
  const rootKey = 'root';
  const childKey = 'child';
  const property = { name: 'Some node!' };

  const cellSetsNodeState = {
    ...initialState,
    properties: {
      [rootKey]: {
        rootNode: true,
      },
      [childKey]: {
        rootNode: false,
        parentNodeKey: 'root',
      },
    },
  };

  beforeEach(() => {
    const response = new Response(JSON.stringify({}));

    config.currentApiVersion = api.V1;

    fetchMock.resetMocks();
    fetchMock.doMock();
    fetchMock.mockResolvedValueOnce(response);
  });

  it('Does not dispatch on loading state', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: true, error: false } });
    store.dispatch(updateCellSetProperty(experimentId, rootKey, property));

    expect(store.getActions().length).toEqual(0);
  });

  it('Does not dispatch on error state', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false, error: true } });
    store.dispatch(updateCellSetProperty(experimentId, rootKey, property));
    expect(store.getActions().length).toEqual(0);
  });

  it('Dispatches an action to update property to the reducer when using a root node', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });
    store.dispatch(updateCellSetProperty(experimentId, rootKey, property));

    await waitForActions(store, [CELL_SETS_UPDATE_PROPERTY]);

    const firstAction = store.getActions()[0];
    expect(firstAction).toMatchSnapshot();
  });

  it('Dispatches an action to update property to the reducer when not using a root node', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });
    store.dispatch(updateCellSetProperty(experimentId, childKey, property));

    await waitForActions(store, [CELL_SETS_UPDATE_PROPERTY]);

    const firstAction = store.getActions()[0];
    expect(firstAction).toMatchSnapshot();
  });

  it('Sends fetch to the API when a cell set\'s property is updated', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });
    await store.dispatch(updateCellSetProperty(experimentId, childKey, property));

    await waitForActions(store, [CELL_SETS_UPDATE_PROPERTY]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, body] = fetchMock.mock.calls[0];

    expect(url).toEqual('http://localhost:3000/v1/experiments/1234/cellSets');
    expect(body).toMatchSnapshot();
  });

  it('Throws when we are updating an invalid prop in root node', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });

    expect(async () => {
      await store.dispatch(updateCellSetProperty(experimentId, rootKey, { children: [] }));
    }).rejects.toThrow();
  });

  it('Throws when we are updating an invalid prop in child node', async () => {
    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });

    expect(async () => {
      await store.dispatch(updateCellSetProperty(experimentId, childKey, { parentNodeKey: 'someOtherParent' }));
    }).rejects.toThrow();
  });

  it('Uses V2 URL when using API version V2', async () => {
    config.currentApiVersion = api.V2;

    const store = mockStore({ cellSets: { ...cellSetsNodeState, loading: false } });
    await store.dispatch(updateCellSetProperty(experimentId, childKey, property));

    await waitForActions(store, [CELL_SETS_UPDATE_PROPERTY]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, body] = fetchMock.mock.calls[0];

    expect(url).toEqual('http://localhost:3000/v2/experiments/1234/cellSets');
    expect(body).toMatchSnapshot();
  });
});
