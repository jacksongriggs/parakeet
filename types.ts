// Type definitions and interfaces

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string | any[];
  timestamp: Date;
  toolCalls?: any[];
  toolResults?: any[];
}

export interface Light {
  entity_id: string;
  friendly_name: string;
  area?: string;
}

export interface ClimateEntity {
  entity_id: string;
  friendly_name: string;
  area?: string;
}