// HTTP server for receiving voice commands from iOS app
import { analyse } from "./ai.ts";
import { tools } from "./tools.ts";
import { logger } from "./logger.ts";

export class VoiceCommandServer {
  private server: Deno.HttpServer | null = null;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
  }

  async start() {
    await logger.info("HTTP_SERVER", "Starting voice command HTTP server", { port: this.port });

    try {
      this.server = Deno.serve({
        port: this.port,
        hostname: "0.0.0.0", // Accept connections from any IP (so iPhone can connect)
      }, async (request) => {
        return await this.handleRequest(request);
      });

      await logger.info("HTTP_SERVER", "Voice command server started successfully", { 
        port: this.port,
        url: `http://localhost:${this.port}`,
        endpoints: ["/", "/health", "/voice-command"]
      });
      
      await logger.info("HTTP_SERVER", "For iOS app connection, use your MacBook's IP address", {
        example: `http://YOUR-MACBOOK-IP:${this.port}/voice-command`,
        tip: "Find your IP with: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes("Address already in use")) {
        await logger.error("HTTP_SERVER", "Port already in use - another Parakeet instance may be running", { 
          port: this.port,
          solution: `Kill existing process: lsof -i :${this.port} then kill <PID>`
        });
        throw new Error(`Port ${this.port} is already in use. Please kill any existing Parakeet instances.`);
      } else {
        await logger.error("HTTP_SERVER", "Failed to start HTTP server", { 
          port: this.port, 
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  }

  async stop() {
    if (this.server) {
      await this.server.shutdown();
      this.server = null;
      await logger.info("HTTP_SERVER", "Voice command server stopped");
    }
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
    
    await logger.debug("HTTP_SERVER", "Incoming request", { 
      method: request.method, 
      path: url.pathname,
      clientIP
    });
    
    // CORS headers for web browser testing
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      await logger.debug("HTTP_SERVER", "Handling CORS preflight request", { path: url.pathname });
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/health" && request.method === "GET") {
      await logger.debug("HTTP_SERVER", "Health check requested");
      return new Response(JSON.stringify({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        service: "parakeet-voice-commands"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Voice command endpoint
    if (url.pathname === "/voice-command" && request.method === "POST") {
      try {
        const body = await request.json();
        const { text, utteranceId } = body;

        if (!text || typeof text !== "string") {
          await logger.warn("HTTP_SERVER", "Invalid request - missing text", { body });
          return new Response(JSON.stringify({ 
            error: "Missing or invalid 'text' field" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const commandText = text.trim();
        if (!commandText) {
          return new Response(JSON.stringify({ 
            error: "Empty text command" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        await logger.info("HTTP_SERVER", "Processing voice command", { 
          text: commandText, 
          utteranceId: utteranceId || "http_request",
          source: "ios_app"
        });

        const startTime = Date.now();
        
        // Process through existing AI pipeline
        const aiResult = await analyse(commandText, tools, utteranceId || `http_${Date.now()}`);
        
        const processingTimeMs = Date.now() - startTime;
        
        await logger.info("HTTP_SERVER", "Voice command completed successfully", { 
          input: commandText, 
          output: aiResult,
          outputLength: aiResult.length,
          processingTimeMs
        });

        return new Response(JSON.stringify({ 
          response: aiResult,
          input: commandText,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("HTTP_SERVER", "Error processing voice command", { error: errorMessage });
        
        return new Response(JSON.stringify({ 
          error: "Internal server error",
          details: errorMessage 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // API info endpoint
    if (url.pathname === "/" && request.method === "GET") {
      await logger.debug("HTTP_SERVER", "API info requested");
      return new Response(JSON.stringify({
        service: "Parakeet Voice Command Server",
        version: "1.0.0",
        endpoints: {
          "GET /": "API information",
          "GET /health": "Health check",
          "POST /voice-command": "Process voice command (requires {text: string, utteranceId?: string})"
        },
        example: {
          url: "/voice-command",
          method: "POST",
          body: {
            text: "turn on kitchen lights",
            utteranceId: "ios_app_123"
          }
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 404 for unknown paths
    await logger.warn("HTTP_SERVER", "Unknown endpoint requested", { 
      method: request.method, 
      path: url.pathname,
      clientIP 
    });
    return new Response(JSON.stringify({ 
      error: "Not found",
      path: url.pathname 
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
