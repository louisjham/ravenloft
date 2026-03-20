/**
 * Test Utilities
 * Reusable helpers for integration and unit tests
 */

// ---------------------------------------------------------------------------
// Console Capture Pattern
// ---------------------------------------------------------------------------

/**
 * Console capture result type
 * TypeScript-safe wrapper for capturing console output
 */
export interface ConsoleCapture<T = string> {
    /** The captured message(s) */
    message: T;
    /** Whether the console method was called */
    called: boolean;
    /** Number of times the console method was called */
    callCount: number;
    /** All captured messages (for multiple calls) */
    messages: T[];
}

/**
 * Capture console output in a TypeScript-safe way
 * 
 * @param method - The console method to capture ('log', 'warn', 'error', 'info', 'debug')
 * @returns A capture object and a restore function
 * 
 * @example
 * ```typescript
 * const { capture, restore } = captureConsole('warn');
 * try {
 *   functionUnderTest();
 *   assert(capture.called);
 *   assert(capture.message.includes('expected text'));
 * } finally {
 *   restore();
 * }
 * ```
 */
export function captureConsole(method: 'log' | 'warn' | 'error' | 'info' | 'debug'): {
    capture: ConsoleCapture;
    restore: () => void;
} {
    const capture: ConsoleCapture = {
        message: '',
        called: false,
        callCount: 0,
        messages: []
    };

    const original = console[method];

    console[method] = (msg: any, ...optionalParams: any[]) => {
        capture.called = true;
        capture.callCount++;
        capture.messages.push(msg);
        capture.message = msg; // Keep last message for convenience
        // Optionally call the original for debugging
        // original.apply(console, [msg, ...optionalParams]);
    };

    const restore = () => {
        console[method] = original;
    };

    return { capture, restore };
}

/**
 * Capture console.warn output (convenience wrapper)
 */
export function captureWarn(): {
    capture: ConsoleCapture;
    restore: () => void;
} {
    return captureConsole('warn');
}

/**
 * Capture console.error output (convenience wrapper)
 */
export function captureError(): {
    capture: ConsoleCapture;
    restore: () => void;
} {
    return captureConsole('error');
}

/**
 * Capture console.log output (convenience wrapper)
 */
export function captureLog(): {
    capture: ConsoleCapture;
    restore: () => void;
} {
    return captureConsole('log');
}

/**
 * Run a function with console output captured
 * 
 * @param method - The console method to capture
 * @param fn - The function to run
 * @returns The capture result
 * 
 * @example
 * ```typescript
 * const result = runWithCapturedConsole('warn', () => {
 *   functionUnderTest();
 * });
 * assert(result.called);
 * assert(result.message.includes('expected text'));
 * ```
 */
export function runWithCapturedConsole<T extends 'log' | 'warn' | 'error' | 'info' | 'debug'>(
    method: T,
    fn: () => void
): ConsoleCapture {
    const { capture, restore } = captureConsole(method);
    try {
        fn();
        return capture;
    } finally {
        restore();
    }
}

// ---------------------------------------------------------------------------
// Pattern Reference Card
// ---------------------------------------------------------------------------

/**
 * CONSOLE CAPTURE PATTERN REFERENCE
 * 
 * ✅ CORRECT — Use the helper functions from this file:
 * ```typescript
 * import { captureWarn, runWithCapturedConsole } from './testUtils';
 * 
 * // Option 1: Manual capture/restore
 * const { capture, restore } = captureWarn();
 * try {
 *   functionUnderTest();
 *   assert(capture.called);
 *   assert(capture.message.includes('expected text'));
 * } finally {
 *   restore();
 * }
 * 
 * // Option 2: Automatic cleanup
 * const result = runWithCapturedConsole('warn', () => {
 *   functionUnderTest();
 * });
 * assert(result.called);
 * assert(result.message.includes('expected text'));
 * ```
 * 
 * ❌ WRONG — let variable, inferred as null literal after callback:
 * ```typescript
 * let msg = null;
 * console.warn = (m: string) => { msg = m };
 * functionUnderTest();
 * if (msg && msg.includes('...')) { ... }  // msg is never
 * ```
 * 
 * ❌ WRONG — explicit annotation, still narrowed to null at const site:
 * ```typescript
 * let msg: string | null = null;
 * console.warn = (m: string) => { msg = m };
 * functionUnderTest();
 * const captured = msg;  // TypeScript sees null here, not string | null
 * if (captured !== null && ...) { ... }  // captured is never
 * ```
 * 
 * ❌ WRONG — type assertion, hides real null risk:
 * ```typescript
 * let msg = null;
 * console.warn = (m: string) => { msg = m };
 * functionUnderTest();
 * if ((msg as string).includes('...')) { ... }  // throws if warn never fires
 * ```
 */
