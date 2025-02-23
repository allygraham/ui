import { v4 as uuidv4 } from 'uuid';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import SocketMock from 'socket.io-mock';
import { dispatchWorkRequest, seekFromS3 } from 'utils/work/seekWorkResponse';
import fake from '__test__/test-utils/constants';
import mockAPI, { generateDefaultMockAPIResponses } from '__test__/test-utils/mockAPI';
import config from 'config';
import { api } from 'utils/constants';

import unpackResult from 'utils/work/unpackResult';

/**
 * jest.mock calls are automatically hoisted to the top of the javascript
 * during compilation. Accordingly, `mockEmit` and `mockOn` as exported
 * from jest.mock will be accessible under `socketConnectionMocks`, even
 * if they do not appear in the original file.
 */
import * as socketConnectionMocks from 'utils/socketConnection';

enableFetchMocks();
uuidv4.mockImplementation(() => 'my-random-uuid');

jest.mock('uuid');

jest.mock('moment', () => () => jest.requireActual('moment')('4022-01-01T00:00:00.000Z'));

jest.mock('utils/socketConnection', () => {
  const mockEmit = jest.fn();
  const mockOn = jest.fn();

  return {
    __esModule: true,
    default: new Promise((resolve) => {
      resolve({ emit: mockEmit, on: mockOn, id: '5678' });
    }),
    mockEmit,
    mockOn,
  };
});

jest.mock('utils/work/unpackResult');

describe('dispatchWorkRequest unit tests', () => {
  const experimentId = fake.EXPERIMENT_ID;
  const timeout = 30;
  const body = {
    name: 'ImportantTask',
    type: 'fake task',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    fetchMock.resetMocks();
    fetchMock.mockIf(/.*/, mockAPI(generateDefaultMockAPIResponses(fake.EXPERIMENT_ID)));

    const socketMock = new SocketMock();

    socketConnectionMocks.mockEmit.mockImplementation((workRequestType, requestBody) => {
      const responseBody = {
        response: {
          error: false,
        },
      };

      const podInfo = {
        response: {
          podInfo: {
            name: 'worker-pod',
            creationTimestamp: '2022-04-29T07:48:47.000Z',
            phase: 'Pending',
          },
        },
      };

      // This is a mocked response emit response from server
      socketMock.socketClient.emit(`WorkResponse-${requestBody.ETag}`, responseBody);
      socketMock.socketClient.emit(`WorkerInfo-${fake.EXPERIMENT_ID}`, podInfo);
    });

    socketConnectionMocks.mockOn.mockImplementation((channel, socketCallback) => {
      // This is a listener for the response from the server
      socketMock.on(channel, (responseBody) => {
        socketCallback(responseBody);
      });
    });
  });

  it('Sends work to the backend when called', async () => {
    fetchMock.mockResponse(JSON.stringify({ signedUrl: 'http://www.apiUrl:portNum/path/blabla' }));

    await dispatchWorkRequest(
      experimentId, body, timeout, 'facefeed',
    );
    expect(socketConnectionMocks.mockEmit).toHaveBeenCalledWith('WorkRequest', {
      ETag: 'facefeed',
      socketId: '5678',
      experimentId: fake.EXPERIMENT_ID,
      timeout: '4022-01-01T00:00:30.000Z',
      body: { name: 'ImportantTask', type: 'fake task' },
    });

    expect(socketConnectionMocks.mockOn).toHaveBeenCalledTimes(2);
  });

  it('Sends work to the backend when called', async () => {
    fetchMock.mockResponse(JSON.stringify({ signedUrl: 'http://www.apiUrl:portNum/path/blabla' }));

    await dispatchWorkRequest(
      experimentId, body, timeout, 'facefeed',
    );
    expect(socketConnectionMocks.mockEmit).toHaveBeenCalledWith('WorkRequest', {
      ETag: 'facefeed',
      socketId: '5678',
      experimentId: fake.EXPERIMENT_ID,
      timeout: '4022-01-01T00:00:30.000Z',
      body: { name: 'ImportantTask', type: 'fake task' },
    });

    expect(socketConnectionMocks.mockOn).toHaveBeenCalledTimes(2);
  });

  it('Returns an error if there is error in the response.', async () => {
    socketConnectionMocks.mockOn.mockImplementation(async (x, f) => {
      f({
        response: {
          error: true,
          errorCode: 'MOCK_ERROR_CODE',
          userMessage: 'Mock worker error message',
        },
      });
    });

    expect(async () => {
      await dispatchWorkRequest(experimentId, body, timeout, 'facefeed');
    }).rejects.toEqual(new Error('MOCK_ERROR_CODE: Mock worker error message'));
  });
  it('When using apiv2 correct work request is sent', async () => {
    config.currentApiVersion = api.V2;
    fetchMock.mockResponse(JSON.stringify({ signedUrl: 'http://www.apiUrl:portNum/path/blabla' }));

    await dispatchWorkRequest(
      experimentId, body, timeout, 'facefeed',
    );
    expect(socketConnectionMocks.mockEmit).toHaveBeenCalledWith('WorkRequest-v2', {
      ETag: 'facefeed',
      socketId: '5678',
      experimentId: fake.EXPERIMENT_ID,
      timeout: '4022-01-01T00:00:30.000Z',
      body: { name: 'ImportantTask', type: 'fake task' },
    });
  });
});

describe('seekFromS3 unit tests', () => {
  const experimentId = fake.EXPERIMENT_ID;
  const result = 'someResult';

  const validResultPath = 'validResultPath';
  const nonExistentResultPath = 'nonExistentResultPath';
  const APIErrorPath = 'APIErrorPath';
  const S3ErrorPath = 'S3ErrorPath';

  const validSignedUrl = 'https://s3.mock/validSignedUrl';
  const invalidSignedUrl = 'https://s3.mock/invalidSignedUrl';

  const mockSignedUrl = { signedUrl: validSignedUrl };
  const mockErrorSignedUrl = { signedUrl: invalidSignedUrl };

  beforeAll(async () => {
    fetchMock.mockIf(/.*/, (req) => {
      const path = req.url;

      if (path.endsWith(validResultPath)) return Promise.resolve(JSON.stringify(mockSignedUrl));
      if (path.endsWith(validSignedUrl)) return Promise.resolve(result);

      if (path.endsWith(nonExistentResultPath)) return Promise.resolve(new Response('Not Found', { status: 404 }));
      if (path.endsWith(APIErrorPath)) return Promise.resolve(new Response('Server error', { status: 500 }));

      if (path.endsWith(S3ErrorPath)) return Promise.resolve(JSON.stringify(mockErrorSignedUrl));
      if (path.endsWith(invalidSignedUrl)) return Promise.resolve(new Response('Forbidden', { status: 403 }));

      return {
        status: 500,
        body: 'Something eror with test',
      };
    });
  });
  beforeEach(async () => {
    config.currentApiVersion = api.V1;

    jest.clearAllMocks();
  });

  it('Should return results correctly', async () => {
    await seekFromS3(validResultPath, experimentId);

    expect(unpackResult).toHaveBeenCalledTimes(1);

    const response = unpackResult.mock.calls[0][0];
    const mockResponsePayload = await response.text();

    expect(mockResponsePayload).toEqual(result);
  });

  it('Should return null if the work results is not found', async () => {
    const response = await seekFromS3(nonExistentResultPath, experimentId);
    expect(response).toEqual(null);
  });

  it('Should throw an error if the API returned an error (except 404)', async () => {
    expect(async () => {
      await seekFromS3(APIErrorPath, experimentId);
    }).rejects.toThrow();
  });

  it('should throw an error if fetching to S3 returns an error', async () => {
    expect(async () => {
      await seekFromS3(S3ErrorPath, experimentId);
    }).rejects.toThrow();
  });

  it('Works for apiv2 ', async () => {
    config.currentApiVersion = api.V2;
    // fetchMock.mockResponseOnce(JSON.stringify({ signedUrl: 'http://www.apiUrl:portNum/path/blabla' }));
    await seekFromS3(validResultPath, experimentId);
    expect(fetchMock.mock.calls[0]).toEqual(['http://localhost:3000/v2/workResults/testae48e318dab9a1bd0bexperiment/validResultPath', { headers: {} }]);
  });
});
