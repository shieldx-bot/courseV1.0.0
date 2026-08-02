/**
 * Minimal type declarations for jest-axe@9 (the package ships no bundled types).
 * Extends Jest matchers with `toHaveNoViolations`.
 */
declare module "jest-axe" {
  export interface AxeViolation {
    id: string;
    impact?: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: unknown[];
  }

  export interface AxeResults {
    violations: AxeViolation[];
    passes: unknown[];
    incomplete: unknown[];
    inapplicable: unknown[];
    timestamp: string;
    url: string;
  }

  export function axe(
    container: HTMLElement,
    options?: Record<string, unknown>
  ): Promise<AxeResults>;

  /**
   * Matcher used via `expect.extend(toHaveNoViolations)`.
   * The index signature satisfies Jest's `ExpectExtendMap` shape.
   */
  export const toHaveNoViolations: {
    (this: jest.MatcherContext, received: HTMLElement, ...actual: unknown[]):
      | jest.CustomMatcherResult
      | Promise<jest.CustomMatcherResult>;
    [key: string]: jest.CustomMatcher;
  };
}

declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R;
  }
}