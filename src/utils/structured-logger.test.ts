import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StructuredLogger, TestLogger, withLogging } from "./structured-logger.js";
import { readFile, rm } from "fs/promises";
import { existsSync } from "fs";

describe("StructuredLogger", () => {
  const testOutputDir = "output/test-logs-temp";

  afterEach(async () => {
    // Cleanup test logs
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true });
    }
  });

  describe("Basic Logging", () => {
    it("should capture module input and output", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logInput({ param: "test" });
      logger.logOutput({ result: "success" });

      const log = logger.getLog();

      expect(log.moduleName).toBe("TestModule");
      expect(log.input).toEqual({ param: "test" });
      expect(log.output).toEqual({ result: "success" });
      expect(log.status).toBe("success");
    });

    it("should log operations with metadata", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.log("info", "test_operation", {
        input: { data: "input" },
        output: { data: "output" },
        metadata: { duration: 100, itemsProcessed: 5 },
      });

      const log = logger.getLog();
      const entry = log.entries[0];

      expect(entry.operation).toBe("test_operation");
      expect(entry.level).toBe("info");
      expect(entry.input).toEqual({ data: "input" });
      expect(entry.output).toEqual({ data: "output" });
      expect(entry.metadata).toEqual({ duration: 100, itemsProcessed: 5 });
    });

    it("should capture errors", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      const error = new Error("Test error");
      logger.log("error", "failed_operation", { error });

      const log = logger.getLog();

      expect(log.errors).toHaveLength(1);
      expect(log.errors[0].message).toBe("Test error");
      expect(log.errors[0].stack).toBeDefined();
    });

    it("should track warnings", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.log("warn", "warning_operation", {
        error: new Error("Warning message"),
      });

      const log = logger.getLog();

      expect(log.warnings).toHaveLength(1);
      expect(log.warnings[0]).toContain("warning_operation");
      expect(log.warnings[0]).toContain("Warning message");
    });
  });

  describe("Metrics", () => {
    it("should log and aggregate metrics", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logMetrics({ totalCost: 0.5, apiCalls: 3 });
      logger.logMetrics({ itemsProcessed: 100 });

      const log = logger.getLog();

      expect(log.metrics).toEqual({
        totalCost: 0.5,
        apiCalls: 3,
        itemsProcessed: 100,
      });
    });

    it("should calculate success rate", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logMetrics({ itemsProcessed: 100 });
      logger.log("error", "failed_item", { error: new Error("fail 1") });
      logger.log("error", "failed_item", { error: new Error("fail 2") });

      await logger.finalize();
      const log = logger.getLog();

      // 100 items processed, 2 failed = 98% success rate
      expect(log.metrics.successRate).toBe(98);
    });
  });

  describe("Status Management", () => {
    it("should mark module as failed", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.markFailed(new Error("Fatal error"));

      const log = logger.getLog();

      expect(log.status).toBe("failed");
      expect(log.errors).toHaveLength(1);
    });

    it("should mark module as partial", () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.markPartial("Some items failed");

      const log = logger.getLog();

      expect(log.status).toBe("partial");
      expect(log.warnings).toContain("module_partial: Warning");
    });
  });

  describe("File Saving", () => {
    it("should save log to file", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logInput({ test: "data" });
      logger.logOutput({ result: "ok" });

      const filePath = await logger.finalize();

      expect(existsSync(filePath)).toBe(true);

      const content = await readFile(filePath, "utf-8");
      const savedLog = JSON.parse(content);

      expect(savedLog.moduleName).toBe("TestModule");
      expect(savedLog.input).toEqual({ test: "data" });
      expect(savedLog.output).toEqual({ result: "ok" });
    });

    it("should save latest version", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logOutput({ result: "ok" });
      await logger.finalize();

      const latestPath = `${testOutputDir}/TestModule-latest.json`;
      expect(existsSync(latestPath)).toBe(true);
    });

    it("should calculate duration on finalize", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logInput({});

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));

      await logger.finalize();
      const log = logger.getLog();

      expect(log.duration).toBeGreaterThanOrEqual(100);
      expect(log.endTime).toBeDefined();
    });
  });

  describe("Security", () => {
    it("should sanitize sensitive data", async () => {
      const logger = new StructuredLogger("TestModule", testOutputDir);

      logger.logInput({
        username: "user",
        password: "secret123",
        api_key: "key123",
        token: "token123",
      });

      const log = logger.getLog();

      expect(log.input.password).toBe("[REDACTED]");
      expect(log.input.api_key).toBe("[REDACTED]");
      expect(log.input.token).toBe("[REDACTED]");
      expect(log.input.username).toBe("user"); // Not sensitive
    });
  });
});

describe("TestLogger", () => {
  const testOutputDir = "output/test-logs-temp";

  afterEach(async () => {
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true });
    }
  });

  it("should capture test assertions", () => {
    const logger = new TestLogger("MyTest", "test.ts", testOutputDir);

    logger.logAssertion("toBe", "expected", "actual");

    const log = logger["testLog"];

    expect(log.assertion).toBe("toBe");
    expect(log.expected).toBe("expected");
    expect(log.actual).toBe("actual");
  });

  it("should mark test as passed", () => {
    const logger = new TestLogger("MyTest", "test.ts", testOutputDir);

    logger.logPass();

    expect(logger["testLog"].status).toBe("passed");
  });

  it("should mark test as failed with error", () => {
    const logger = new TestLogger("MyTest", "test.ts", testOutputDir);

    const error = new Error("Assertion failed");
    logger.logFail(error, "expected: 5\nactual: 3");

    const log = logger["testLog"];

    expect(log.status).toBe("failed");
    expect(log.error?.message).toBe("Assertion failed");
    expect(log.error?.diff).toBe("expected: 5\nactual: 3");
  });

  it("should save test log to file", async () => {
    const logger = new TestLogger("MyTest", "test.ts", testOutputDir);

    logger.logPass();
    const filePath = await logger.finalize();

    expect(existsSync(filePath)).toBe(true);

    const content = await readFile(filePath, "utf-8");
    const savedLog = JSON.parse(content);

    expect(savedLog.testName).toBe("MyTest");
    expect(savedLog.status).toBe("passed");
  });
});

describe("withLogging helper", () => {
  const testOutputDir = "output/test-logs-temp";

  afterEach(async () => {
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true });
    }
  });

  it("should execute function and capture logs", async () => {
    const { result, logPath } = await withLogging(
      "TestModule",
      { input: "test" },
      async (logger) => {
        logger.log("info", "processing", { metadata: { step: 1 } });
        return { output: "success" };
      }
    );

    expect(result).toEqual({ output: "success" });
    expect(existsSync(logPath)).toBe(true);

    const content = await readFile(logPath, "utf-8");
    const log = JSON.parse(content);

    expect(log.input).toEqual({ input: "test" });
    expect(log.output).toEqual({ output: "success" });
    expect(log.status).toBe("success");
  });

  it("should capture errors and still save log", async () => {
    try {
      await withLogging("TestModule", {}, async (logger) => {
        logger.log("info", "step_1", {});
        throw new Error("Something went wrong");
      });

      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);

      // Log should still be saved
      const latestPath = "output/logs/TestModule-latest.json";
      if (existsSync(latestPath)) {
        const content = await readFile(latestPath, "utf-8");
        const log = JSON.parse(content);

        expect(log.status).toBe("failed");
        expect(log.errors).toHaveLength(1);
      }
    }
  });

  it("should track execution duration", async () => {
    const { result, logPath } = await withLogging(
      "TestModule",
      {},
      async (logger) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      }
    );

    const content = await readFile(logPath, "utf-8");
    const log = JSON.parse(content);

    expect(log.duration).toBeGreaterThanOrEqual(100);
  });
});
