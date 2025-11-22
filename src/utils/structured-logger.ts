/**
 * Structured Logging System for LLM Review
 * Captures module execution data in a format that an LLM can analyze and improve
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

export interface LogEntry {
  timestamp: string;
  moduleName: string;
  operation: string;
  level: "info" | "warn" | "error" | "success";
  input?: any;
  output?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    duration?: number; // milliseconds
    cost?: number; // dollars
    itemsProcessed?: number;
    apiCallsMade?: number;
    [key: string]: any;
  };
}

export interface ModuleExecutionLog {
  sessionId: string;
  moduleName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "running" | "success" | "failed" | "partial";
  input: any;
  output?: any;
  errors: Array<{ message: string; stack?: string; timestamp: string }>;
  warnings: string[];
  entries: LogEntry[];
  metrics: {
    totalCost?: number;
    apiCalls?: number;
    itemsProcessed?: number;
    successRate?: number;
    [key: string]: any;
  };
}

export interface TestExecutionLog {
  sessionId: string;
  testName: string;
  testFile: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "running" | "passed" | "failed";
  expected?: any;
  actual?: any;
  assertion?: string;
  error?: {
    message: string;
    stack?: string;
    diff?: string;
  };
  logs: LogEntry[];
}

export class StructuredLogger {
  private sessionId: string;
  private moduleName: string;
  private executionLog: ModuleExecutionLog;
  private outputDir: string;

  constructor(moduleName: string, outputDir = "output/logs") {
    this.moduleName = moduleName;
    this.sessionId = `${moduleName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.outputDir = outputDir;

    this.executionLog = {
      sessionId: this.sessionId,
      moduleName,
      startTime: new Date().toISOString(),
      status: "running",
      input: null,
      errors: [],
      warnings: [],
      entries: [],
      metrics: {},
    };
  }

  /**
   * Log module input
   */
  logInput(input: any): void {
    this.executionLog.input = this.sanitize(input);
    this.log("info", "module_input", { input: this.sanitize(input) });
  }

  /**
   * Log module output
   */
  logOutput(output: any): void {
    this.executionLog.output = this.sanitize(output);
    this.executionLog.status = "success";
    this.log("success", "module_output", { output: this.sanitize(output) });
  }

  /**
   * Log an operation
   */
  log(
    level: "info" | "warn" | "error" | "success",
    operation: string,
    data?: {
      input?: any;
      output?: any;
      error?: Error;
      metadata?: any;
    }
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      moduleName: this.moduleName,
      operation,
      level,
    };

    if (data?.input) {
      entry.input = this.sanitize(data.input);
    }

    if (data?.output) {
      entry.output = this.sanitize(data.output);
    }

    if (data?.error) {
      entry.error = {
        message: data.error.message,
        stack: data.error.stack,
        code: (data.error as any).code,
      };

      this.executionLog.errors.push({
        message: data.error.message,
        stack: data.error.stack,
        timestamp: entry.timestamp,
      });
    }

    if (data?.metadata) {
      entry.metadata = data.metadata;
    }

    this.executionLog.entries.push(entry);

    if (level === "warn") {
      this.executionLog.warnings.push(`${operation}: ${data?.error?.message || "Warning"}`);
    }
  }

  /**
   * Log metrics (cost, API calls, etc.)
   */
  logMetrics(metrics: Record<string, any>): void {
    this.executionLog.metrics = {
      ...this.executionLog.metrics,
      ...metrics,
    };
    this.log("info", "metrics_update", { metadata: metrics });
  }

  /**
   * Mark module as failed
   */
  markFailed(error: Error): void {
    this.executionLog.status = "failed";
    this.log("error", "module_failed", { error });
  }

  /**
   * Mark module as partially successful
   */
  markPartial(reason: string): void {
    this.executionLog.status = "partial";
    this.log("warn", "module_partial", { metadata: { reason } });
  }

  /**
   * Calculate and save final log
   */
  async finalize(): Promise<string> {
    this.executionLog.endTime = new Date().toISOString();
    this.executionLog.duration =
      new Date(this.executionLog.endTime).getTime() -
      new Date(this.executionLog.startTime).getTime();

    // Calculate success rate if applicable
    if (this.executionLog.metrics.itemsProcessed) {
      const failed = this.executionLog.errors.length;
      const total = this.executionLog.metrics.itemsProcessed;
      this.executionLog.metrics.successRate = ((total - failed) / total) * 100;
    }

    const filePath = await this.save();
    return filePath;
  }

  /**
   * Save log to file
   */
  private async save(): Promise<string> {
    try {
      await mkdir(this.outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${this.moduleName}-${timestamp}.json`;
      const filePath = `${this.outputDir}/${fileName}`;

      await writeFile(filePath, JSON.stringify(this.executionLog, null, 2));

      // Also save a "latest" version for easy access
      const latestPath = `${this.outputDir}/${this.moduleName}-latest.json`;
      await writeFile(latestPath, JSON.stringify(this.executionLog, null, 2));

      return filePath;
    } catch (error) {
      console.error("Failed to save log:", error);
      throw error;
    }
  }

  /**
   * Get current log
   */
  getLog(): ModuleExecutionLog {
    return this.executionLog;
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(data: any): any {
    if (!data) return data;

    const str = JSON.stringify(data);
    const sanitized = str
      .replace(/("password"|"api_key"|"token"|"secret"):\s*"[^"]+"/gi, '$1: "[REDACTED]"')
      .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer [REDACTED]")
      .replace(/Basic\s+\S+/gi, "Basic [REDACTED]");

    try {
      return JSON.parse(sanitized);
    } catch {
      return sanitized;
    }
  }
}

/**
 * Test Logger - specialized for test execution
 */
export class TestLogger {
  private sessionId: string;
  private testLog: TestExecutionLog;
  private outputDir: string;

  constructor(testName: string, testFile: string, outputDir = "output/test-logs") {
    this.sessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.outputDir = outputDir;

    this.testLog = {
      sessionId: this.sessionId,
      testName,
      testFile,
      startTime: new Date().toISOString(),
      status: "running",
      logs: [],
    };
  }

  logAssertion(assertion: string, expected: any, actual: any): void {
    this.testLog.assertion = assertion;
    this.testLog.expected = expected;
    this.testLog.actual = actual;

    this.log("info", "assertion", {
      metadata: { assertion, expected, actual },
    });
  }

  logPass(): void {
    this.testLog.status = "passed";
    this.log("success", "test_passed", {});
  }

  logFail(error: Error, diff?: string): void {
    this.testLog.status = "failed";
    this.testLog.error = {
      message: error.message,
      stack: error.stack,
      diff,
    };
    this.log("error", "test_failed", { error });
  }

  log(
    level: "info" | "warn" | "error" | "success",
    operation: string,
    data?: {
      input?: any;
      output?: any;
      error?: Error;
      metadata?: any;
    }
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      moduleName: this.testLog.testFile,
      operation,
      level,
      input: data?.input,
      output: data?.output,
      error: data?.error
        ? {
            message: data.error.message,
            stack: data.error.stack,
          }
        : undefined,
      metadata: data?.metadata,
    };

    this.testLog.logs.push(entry);
  }

  async finalize(): Promise<string> {
    this.testLog.endTime = new Date().toISOString();
    this.testLog.duration =
      new Date(this.testLog.endTime).getTime() - new Date(this.testLog.startTime).getTime();

    await mkdir(this.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${this.testLog.testName}-${timestamp}.json`;
    const filePath = `${this.outputDir}/${fileName}`;

    await writeFile(filePath, JSON.stringify(this.testLog, null, 2));

    return filePath;
  }
}

/**
 * Helper function to run a module with structured logging
 */
export async function withLogging<T>(
  moduleName: string,
  input: any,
  fn: (logger: StructuredLogger) => Promise<T>
): Promise<{ result: T; logPath: string }> {
  const logger = new StructuredLogger(moduleName);

  try {
    logger.logInput(input);
    const result = await fn(logger);
    logger.logOutput(result);
    const logPath = await logger.finalize();

    return { result, logPath };
  } catch (error) {
    logger.markFailed(error as Error);
    const logPath = await logger.finalize();
    throw error;
  }
}
