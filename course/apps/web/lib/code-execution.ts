"use client";

/**
 * Code execution utility for the IDE
 * This provides a mock implementation for code execution
 */
export function executeCode(language: string, code: string): {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
} {
  try {
    const startTime = Date.now();

    // Mock execution - in a real implementation, this would execute the code
    // For now, we'll simulate execution based on the code content
    if (!code.trim()) {
      return {
        success: false,
        error: "No code to execute",
        executionTime: 0,
      };
    }

    // Simulate some execution time
    const simulatedExecutionTime = Math.random() * 100 + 50; // 50-150ms

    // Check for obvious syntax errors (very basic check)
    if (language === "python") {
      if (code.includes("def ") && !code.includes(":")) {
        return {
          success: false,
          error: "SyntaxError: expected ':'",
          executionTime: simulatedExecutionTime,
        };
      }
    } else if (language === "javascript") {
      if (code.includes("function ") && !code.includes("{")) {
        return {
          success: false,
          error: "SyntaxError: expected '{'",
          executionTime: simulatedExecutionTime,
        };
      }
    }

    // Simulate successful execution
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    return {
      success: true,
      output: `Code executed successfully in ${executionTime}ms`,
      executionTime: executionTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown execution error",
      executionTime: 0,
    };
  }
}