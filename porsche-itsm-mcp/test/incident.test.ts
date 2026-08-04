import { IncidentService } from '../src/api/incident/incident.service.js';
import { DeveloperHubClient } from '../src/clients/DeveloperHubClient.js';
import { createIncidentTools, handleIncidentTool } from '../src/api/incident/incident.tools.js';
import { CreateIncidentRequest } from '../src/api/incident/incident.types.js';

// Import jest types for TypeScript
import 'jest';

jest.mock('../src/clients/DeveloperHubClient.js');

describe('IncidentService', () => {
  let incidentService: IncidentService;
  let mockClient: jest.Mocked<DeveloperHubClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    incidentService = new IncidentService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createIncident', () => {
    test('should create incident successfully', async () => {
      const mockResponse = 'INC123456';
      mockClient.post.mockResolvedValueOnce(mockResponse);

      const incident: CreateIncidentRequest = {
        title: 'Test Incident',
        details: 'Test details',
        upn: 'test.user',
        assignedGroup: 'Test Group',
        assignedSupportCompany: 'Porsche',
        assignedSupportOrganization: 'Platform'
      };

      const result = await incidentService.createIncident(incident);

      expect(mockClient.post).toHaveBeenCalledWith('/incident', incident);
      expect(result).toEqual({ id: mockResponse });
    });

    test('should handle create incident error', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const incident: CreateIncidentRequest = {
        title: 'Test Incident',
        details: 'Test details',
        upn: 'test.user',
        assignedGroup: 'Test Group',
        assignedSupportCompany: 'Porsche',
        assignedSupportOrganization: 'Platform'
      };

      await expect(incidentService.createIncident(incident))
        .rejects.toThrow('Failed to create incident: API Error');
    });
  });

  describe('getIncidents', () => {
    test('should get incidents with filter', async () => {
      const mockResponse = 'incidents-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const filter = { assignedGroup: 'Test Group' };
      const result = await incidentService.getIncidents(filter);
      expect(result).toEqual([{ id: mockResponse }]);
    });
  });

  describe('getIncident', () => {
    test('should get specific incident', async () => {
      const mockResponse = 'incident-data';
      mockClient.get.mockResolvedValueOnce(mockResponse);

      const result = await incidentService.getIncident('INC123456');

      expect(result).toEqual({ id: mockResponse });
    });
  });

  describe('updateIncident', () => {
    test('should update incident successfully', async () => {
      const mockResponse = 'updated-incident-data';
      mockClient.put.mockResolvedValueOnce(mockResponse);

      const updates = { status: 'In Progress' as const };
      const result = await incidentService.updateIncident('INC123456', updates);

      expect(result).toEqual({ id: mockResponse });
    });
  });
});

describe('IncidentTools', () => {
  let incidentService: IncidentService;
  let mockClient: jest.Mocked<DeveloperHubClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;
    
    incidentService = new IncidentService(mockClient);
  });

  test('should create incident tools', () => {
    const tools = createIncidentTools();
    
    expect(tools).toHaveLength(4);
    expect(tools.map(t => t.name)).toEqual([
      'create_incident',
      'get_incidents', 
      'get_incident',
      'update_incident'
    ]);
  });

  test('should handle create_incident tool', async () => {
    mockClient.post.mockResolvedValueOnce('INC123456');

    const args = {
      title: 'Test Incident',
      details: 'Test details',
      upn: 'test.user',
      assignedGroup: 'Test Group',
      assignedSupportCompany: 'Porsche',
      assignedSupportOrganization: 'Platform'
    };

    const result = await handleIncidentTool('create_incident', args, incidentService);
    
    expect(result).toEqual({ id: 'INC123456' });
  });

  test('should throw error for unknown tool', async () => {
    await expect(handleIncidentTool('unknown_tool', {}, incidentService))
      .rejects.toThrow('Unknown incident tool: unknown_tool');
  });
});
