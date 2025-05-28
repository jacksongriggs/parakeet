// Type definitions and interfaces

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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