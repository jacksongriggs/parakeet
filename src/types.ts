// Type definitions and interfaces
import type { CoreAssistantMessage, CoreToolMessage } from "ai";

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string | CoreAssistantMessage["content"] | CoreToolMessage["content"];
  timestamp: Date;
}

export interface Light {
  entity_id: string;
  friendly_name: string;
  area?: string;
  supported_color_modes?: string[];
  color_mode?: string;
}

export interface ClimateEntity {
  entity_id: string;
  friendly_name: string;
  area?: string;
}

export interface MediaPlayer {
  entity_id: string;
  friendly_name: string;
  area?: string;
  state: string;
  volume?: number;
}