import _ from 'lodash';

import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';

import {
  EXPERIMENTS_ERROR,
  EXPERIMENTS_SAVING,
  EXPERIMENTS_UPDATED,
} from 'redux/actionTypes/experiments';
import { reorderSamples } from 'redux/actions/experiments';
import initialExperimentState, { experimentTemplate } from 'redux/reducers/experiments/initialState';

import config from 'config';
import { api } from 'utils/constants';

import '__test__/test-utils/setupTests';

jest.mock('config');

const mockStore = configureStore([thunk]);

enableFetchMocks();

describe('updateExperiment', () => {
  const experimentId = 'experiment-1';
  const oldIndex = 0;
  const newIndex = 1;
  const newSampleOrder = ['sample2', 'sample1'];

  const mockExperiment = {
    ...experimentTemplate,
    name: 'experiment-1',
    id: experimentId,
  };

  const mockState = {
    experiments: {
      ...initialExperimentState,
      [experimentId]: mockExperiment,
    },
  };

  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.doMock();
  });

  it('Updates properties with api v2 correctly', async () => {
    config.currentApiVersion = api.V2;

    const response = new Response(JSON.stringify({}));
    fetchMock.mockResolvedValueOnce(response);

    const store = mockStore(mockState);
    await store.dispatch(reorderSamples(experimentId, oldIndex, newIndex, newSampleOrder));

    const actions = store.getActions();
    expect(_.map(actions, 'type')).toEqual([EXPERIMENTS_SAVING, EXPERIMENTS_UPDATED]);
    expect(_.map(actions, 'payload')).toMatchSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/v2/experiments/${experimentId}/samples/position`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          oldPosition: oldIndex,
          newPosition: newIndex,
        }),
      }),
    );
  });

  it('Handles error with api v2 and then rethrows (so the UI doesnt reorder)', async () => {
    config.currentApiVersion = api.V2;

    const error = new Error('Some api error');

    fetchMock.mockRejectOnce(() => Promise.reject(error));

    const store = mockStore(mockState);
    await expect(
      store.dispatch(reorderSamples(experimentId, oldIndex, newIndex, newSampleOrder)),
    ).rejects.toThrow(new Error(`Error: ${error.message}`));

    const actions = store.getActions();
    expect(_.map(actions, 'type')).toEqual([EXPERIMENTS_SAVING, EXPERIMENTS_ERROR]);
    expect(_.map(actions, 'payload')).toMatchSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/v2/experiments/${experimentId}/samples/position`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          oldPosition: oldIndex,
          newPosition: newIndex,
        }),
      }),
    );
  });
});
