import { StatusToxicConfig, ToxicType } from '../types.js';

export class StatusToxic {
  readonly type: ToxicType = 'status';
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly responseBody?: string;

  constructor(config: StatusToxicConfig) {
    this.statusCode = config.statusCode;
    this.statusMessage = config.statusMessage || this.getDefaultMessage(config.statusCode);
    this.responseBody = config.responseBody;
  }

  private getDefaultMessage(code: number): string {
    switch (code) {
      case 400: return 'Bad Request (FaultMesh Injected)';
      case 429: return 'Too Many Requests (FaultMesh Rate-Limit)';
      case 500: return 'Internal Server Error (FaultMesh Injected)';
      case 502: return 'Bad Gateway (FaultMesh Upstream Dropped)';
      case 503: return 'Service Unavailable (FaultMesh Maintenance)';
      case 504: return 'Gateway Timeout (FaultMesh Deadlock)';
      default: return 'FaultMesh Overridden Status';
    }
  }
}
