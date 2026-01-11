import {
  HAConfig,
  HAState,
  HAServiceCallData,
  HAHistoryParams,
  HAServiceDomain,
} from './types.js';

export class HAClient {
  private baseUrl: string;
  private token: string;

  constructor(config: HAConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create abort controller for timeout (30 seconds for HA requests)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.text();
          try {
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.message || JSON.stringify(errorJson);
          } catch {
            errorMessage = errorBody || errorMessage;
          }
        } catch {
          // Use statusText if we can't read the body
        }

        throw new Error(
          `Home Assistant API error (${response.status}): ${errorMessage}`
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Home Assistant API request timed out');
        }
        throw error;
      }
      throw new Error(`Home Assistant API request failed: ${String(error)}`);
    }
  }

  // ===== State Methods =====

  async getStates(): Promise<HAState[]> {
    return this.request<HAState[]>('/api/states');
  }

  async getState(entityId: string): Promise<HAState> {
    return this.request<HAState>(`/api/states/${encodeURIComponent(entityId)}`);
  }

  async setState(entityId: string, state: string, attributes?: Record<string, any>): Promise<HAState> {
    return this.request<HAState>(`/api/states/${encodeURIComponent(entityId)}`, {
      method: 'POST',
      body: JSON.stringify({
        state,
        attributes: attributes || {},
      }),
    });
  }

  // ===== Service Methods =====

  async getServices(): Promise<HAServiceDomain[]> {
    return this.request<HAServiceDomain[]>('/api/services');
  }

  async callService(data: HAServiceCallData): Promise<HAState[]> {
    const { domain, service, service_data, target } = data;

    // Home Assistant expects a flat payload with service_data and target fields merged at root level
    const payload: any = {
      ...service_data,
    };

    if (target) {
      // Merge target fields into the root payload
      if (target.entity_id) {
        payload.entity_id = target.entity_id;
      }
      if (target.device_id) {
        payload.device_id = target.device_id;
      }
      if (target.area_id) {
        payload.area_id = target.area_id;
      }
    }

    return this.request<HAState[]>(
      `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  // ===== History Methods =====

  async getHistory(params: HAHistoryParams): Promise<HAState[][]> {
    const queryParams = new URLSearchParams();

    if (params.start_time) {
      queryParams.append('filter_entity_id', params.entity_id || '');
    }
    if (params.end_time) {
      queryParams.append('end_time', params.end_time);
    }
    if (params.minimal_response) {
      queryParams.append('minimal_response', 'true');
    }

    const endpoint = params.start_time
      ? `/api/history/period/${params.start_time}?${queryParams.toString()}`
      : `/api/history/period?${queryParams.toString()}`;

    return this.request<HAState[][]>(endpoint);
  }

  // ===== Helper Methods =====

  async ping(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/');
  }

  async getConfig(): Promise<any> {
    return this.request<any>('/api/config');
  }

  async getErrorLog(): Promise<string> {
    return this.request<string>('/api/error_log');
  }
}
