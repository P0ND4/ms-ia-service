export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode: number;
}

export class ApiResponseBuilder {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      statusCode: 200,
    };
  }

  static error(error: string, statusCode: number = 500): ApiResponse {
    return {
      success: false,
      error,
      statusCode,
    };
  }
}
