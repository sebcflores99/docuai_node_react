/**
 * Minimal structured logger. Emits one JSON line per event so logs are easy to
 * grep/scan in `docker compose logs` while the document vectorization pipeline
 * runs (extraction -> chunking -> embedding -> Weaviate upsert -> READY).
 *
 * Intentionally dependency-free; swap for pino/winston if richer transport is
 * needed later.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that merges `bound` context into every entry. */
  child(bound: LogContext): Logger;
}

function make(bound: LogContext = {}): Logger {
  return {
    debug: (message, context) => emit('debug', message, { ...bound, ...context }),
    info: (message, context) => emit('info', message, { ...bound, ...context }),
    warn: (message, context) => emit('warn', message, { ...bound, ...context }),
    error: (message, context) => emit('error', message, { ...bound, ...context }),
    child: (childBound) => make({ ...bound, ...childBound }),
  };
}

export const logger: Logger = make();
