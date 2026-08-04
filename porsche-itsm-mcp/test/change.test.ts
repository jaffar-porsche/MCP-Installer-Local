import { ChangeService } from '../src/api/change/change.service.js';
import { DeveloperHubClient } from '../src/clients/DeveloperHubClient.js';
import { createChangeTools, handleChangeTool } from '../src/api/change/change.tools.js';
import { CreateChangeRequest } from '../src/api/change/change.types.js';

jest.mock('../src/clients/DeveloperHubClient.js');

describe('ChangeService', () => {
  let changeService: ChangeService;
  let mockClient: jest.Mocked<DeveloperHubClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    changeService = new ChangeService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createChange', () => {
    test('should create change successfully', async () => {
      const mockResponse = { infrastructureChangeId: 'CRQ123456' };
      mockClient.post.mockResolvedValueOnce(mockResponse);

      const change: CreateChangeRequest = {
        upn: 'test.user',
        changeDescription: 'Test change description',
        changeType: 'Change',
        scheduledTiming: 'Normal',
        impactLevel: 3,
        urgencyLevel: 4,
        companyName: 'Porsche',
        locationName: 'Porsche',
        supportGroupName: 'Platform Team',
        supportOrgName: 'Platform',
        templateId: 'TEMPLATE123'
      };

      const result = await changeService.createChange(change);

      expect(mockClient.post).toHaveBeenCalledWith('/change', change);
      expect(result).toEqual(mockResponse);
    });

    test('should handle create change error', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const change: CreateChangeRequest = {
        upn: 'test.user',
        changeDescription: 'Test change description',
        changeType: 'Change',
        scheduledTiming: 'Normal',
        impactLevel: 3,
        urgencyLevel: 4,
        companyName: 'Porsche',
        locationName: 'Porsche',
        supportGroupName: 'Platform Team',
        supportOrgName: 'Platform',
        templateId: 'TEMPLATE123'
      };

      await expect(changeService.createChange(change))
        .rejects.toThrow('Failed to create change: API Error');
    });
  });

  describe('getChange', () => {
    test('should get change successfully', async () => {
      const mockResponse = 'change-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const result = await changeService.getChange('CRQ123456');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getChangeTasks', () => {
    test('should get change tasks successfully', async () => {
      const mockResponse = 'tasks-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const result = await changeService.getChangeTasks('CRQ123456');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getChangeWorkLogs', () => {
    test('should get change work logs successfully', async () => {
      const mockResponse = 'worklogs-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const result = await changeService.getChangeWorkLogs('CRQ123456');

      expect(result).toEqual(mockResponse);
    });

    test('should get change work logs with filter', async () => {
      const mockResponse = 'filtered-worklogs-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const filter = { workInfoType: 'General Information', viewAccess: 'Public' };
      const result = await changeService.getChangeWorkLogs('CRQ123456', filter);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/change/CRQ123456/worklogs',
        { filter: "'workInfoType'=\"General Information\" AND 'viewAccess'=\"Public\"" },
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });
  });
});

describe('ChangeTools', () => {
  let changeService: ChangeService;
  let mockClient: jest.Mocked<DeveloperHubClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    changeService = new ChangeService(mockClient);
  });

  test('should create change tools', () => {
    const tools = createChangeTools();
    
    expect(tools).toHaveLength(4);
    expect(tools.map(t => t.name)).toEqual([
      'create_change',
      'get_change',
      'get_change_tasks',
      'get_change_worklogs'
    ]);
  });

  test('should handle create_change tool', async () => {
    mockClient.post.mockResolvedValueOnce({ infrastructureChangeId: 'CRQ123456' });

    const args = {
      upn: 'test.user',
      changeDescription: 'Test change description',
      changeType: 'Change',
      scheduledTiming: 'Normal',
      impactLevel: 3,
      urgencyLevel: 4,
      companyName: 'Porsche',
      locationName: 'Porsche',
      supportGroupName: 'Platform Team',
      supportOrgName: 'Platform',
      templateId: 'TEMPLATE123'
    };

    const result = await handleChangeTool('create_change', args, changeService);
    
    expect(result).toEqual({ infrastructureChangeId: 'CRQ123456' });
  });

  test('should handle get_change tool', async () => {
    mockClient.get.mockResolvedValueOnce('change-data');

    const result = await handleChangeTool('get_change', { id: 'CRQ123456' }, changeService);
    
    expect(result).toEqual({ data: 'change-data' });
  });

  test('should handle get_change_worklogs tool with filter', async () => {
    mockClient.get.mockResolvedValueOnce('worklogs-data');

    const args = {
      id: 'CRQ123456',
      workInfoType: 'General Information',
      viewAccess: 'Public'
    };

    const result = await handleChangeTool('get_change_worklogs', args, changeService);
    
    expect(result).toEqual({ data: 'worklogs-data' });
  });

  test('should throw error for unknown tool', async () => {
    await expect(handleChangeTool('unknown_tool', {}, changeService))
      .rejects.toThrow('Unknown change tool: unknown_tool');
  });
});
