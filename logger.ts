// Logging utility for Parakeet voice assistant

import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { format } from "https://deno.land/std@0.224.0/datetime/format.ts";

export interface LogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  data?: unknown;
}

export class Logger {
  private logDir: string;
  private sessionId: string;
  private sessionStartTime: Date;

  constructor(logDir: string = "./logs") {
    this.logDir = logDir;
    this.sessionStartTime = new Date();
    this.sessionId = format(this.sessionStartTime, "yyyy-MM-dd_HH-mm-ss");
  }

  private async ensureLogDir(): Promise<void> {
    await ensureDir(this.logDir);
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = format(entry.timestamp, "yyyy-MM-dd HH:mm:ss.SSS");
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source.padEnd(15);
    
    let logLine = `[${timestamp}] ${level} ${source} ${entry.message}`;
    
    if (entry.data) {
      logLine += ` | ${JSON.stringify(entry.data)}`;
    }
    
    return logLine + "\n";
  }

  private async writeToFile(content: string): Promise<void> {
    await this.ensureLogDir();
    const filename = `parakeet_${this.sessionId}.log`;
    const filepath = `${this.logDir}/${filename}`;
    
    try {
      await Deno.writeTextFile(filepath, content, { append: true });
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  async log(level: "info" | "warn" | "error" | "debug", source: string, message: string, data?: unknown): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      source,
      message,
      data
    };

    const formattedEntry = this.formatLogEntry(entry);
    
    // Write to file
    await this.writeToFile(formattedEntry);
    
    // Also log to console with color coding
    const colors = {
      info: "\x1b[36m",    // cyan
      warn: "\x1b[33m",    // yellow
      error: "\x1b[31m",   // red
      debug: "\x1b[90m",   // gray
    };
    const reset = "\x1b[0m";
    
    console.log(`${colors[level]}${formattedEntry.trim()}${reset}`);
  }

  async info(source: string, message: string, data?: unknown): Promise<void> {
    await this.log("info", source, message, data);
  }

  async warn(source: string, message: string, data?: unknown): Promise<void> {
    await this.log("warn", source, message, data);
  }

  async error(source: string, message: string, data?: unknown): Promise<void> {
    await this.log("error", source, message, data);
  }

  async debug(source: string, message: string, data?: unknown): Promise<void> {
    await this.log("debug", source, message, data);
  }

  async sessionStart(): Promise<void> {
    await this.info("SESSION", "Parakeet session started", {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime.toISOString()
    });
  }

  async sessionEnd(): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.sessionStartTime.getTime();
    
    await this.info("SESSION", "Parakeet session ended", {
      sessionId: this.sessionId,
      endTime: endTime.toISOString(),
      duration: `${Math.round(duration / 1000)}s`
    });
  }
}

// Global logger instance
export const logger = new Logger();