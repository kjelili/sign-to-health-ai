/**
 * Hume AI Service
 * 
 * Real-time emotion detection using Hume AI Expression Measurement API.
 * Uses WebSocket for streaming facial expression analysis.
 * 
 * API Documentation: https://dev.hume.ai/docs/expression-measurement/websocket
 * 
 * Features:
 * - Real-time facial expression analysis
 * - 48 emotion dimensions detected
 * - Pain, distress, anxiety measurement
 * - Automatic reconnection handling
 * - Fallback to gesture-based inference
 */

import {
  type HumeEmotionScore,
  type HumeAnalysisResult,
  calculatePainLevel,
  calculateDistressLevel,
  getMedicalEmotionCategory,
  getTopEmotions,
} from "./humeEmotions";

// Hume API configuration
const HUME_WS_URL = "wss://api.hume.ai/v0/stream/models";
const RECONNECT_DELAY = 3000; // 3 seconds
const CONNECTION_TIMEOUT = 60000; // 1 minute (Hume's default)
const FRAME_INTERVAL = 500; // Send frame every 500ms

/**
 * Processed emotion result for application use
 */
export interface ProcessedEmotionResult {
  // Core metrics (0-1 scale)
  painLevel: number;
  distress: number;
  anxiety: number;
  confusion: number;
  anger: number;
  
  // Primary emotion
  primaryEmotion: string;
  primaryEmotionScore: number;
  
  // Medical category
  category: string;
  categoryLabel: string;
  
  // Top 5 emotions
  topEmotions: HumeEmotionScore[];
  
  // Raw Hume data
  rawEmotions: HumeEmotionScore[];
  
  // Metadata
  confidence: number;
  timestamp: number;
  source: "hume" | "fallback";
}

/**
 * Hume AI WebSocket service for real-time emotion detection
 */
export class HumeService {
  private ws: WebSocket | null = null;
  private apiKey: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onResultCallback: ((result: ProcessedEmotionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onStatusCallback: ((status: string) => void) | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFrameTime = 0;

  constructor() {
    // API key will be set via configure()
  }

  /**
   * Configure the service with API key
   */
  configure(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check if connected to Hume
   */
  isActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to Hume AI WebSocket
   */
  async connect(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn("Hume AI: API key not configured");
      this.onStatusCallback?.("Not configured - using fallback");
      return false;
    }

    if (this.isActive()) {
      return true;
    }

    return new Promise((resolve) => {
      try {
        // Connect with API key as query param (browser WebSocket doesn't support headers)
        const url = `${HUME_WS_URL}?apiKey=${this.apiKey}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onStatusCallback?.("Connected to Hume AI");
          console.log("Hume AI: WebSocket connected");
          
          // Set connection timeout (Hume disconnects after 1 min of inactivity)
          this.resetConnectionTimeout();
          
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error("Hume AI: Failed to parse message", err);
          }
        };

        this.ws.onerror = (event) => {
          console.error("Hume AI: WebSocket error", event);
          this.onErrorCallback?.(new Error("WebSocket connection error"));
          this.onStatusCallback?.("Connection error");
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          console.log("Hume AI: WebSocket closed", event.code, event.reason);
          this.onStatusCallback?.("Disconnected");
          
          // Clear timeout
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
          }
          
          // Attempt reconnect if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.onStatusCallback?.(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), RECONNECT_DELAY);
          }
        };

        // Timeout for initial connection
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            this.onStatusCallback?.("Connection timeout - using fallback");
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error("Hume AI: Failed to create WebSocket", error);
        this.onStatusCallback?.("Failed to connect - using fallback");
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from Hume AI
   */
  disconnect(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.isConnected = false;
    this.onStatusCallback?.("Disconnected");
  }

  /**
   * Reset connection timeout (called on each message)
   */
  private resetConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.connectionTimeout = setTimeout(() => {
      // Send a ping to keep connection alive or reconnect
      if (this.isActive()) {
        this.disconnect();
        this.connect();
      }
    }, CONNECTION_TIMEOUT - 5000); // Reconnect 5s before timeout
  }

  /**
   * Send video frame for analysis
   * @param imageData Base64 encoded image data
   */
  async analyzeFrame(imageData: string): Promise<void> {
    // Rate limit frame sends
    const now = Date.now();
    if (now - this.lastFrameTime < FRAME_INTERVAL) {
      return;
    }
    this.lastFrameTime = now;

    if (!this.isActive()) {
      // Try to reconnect
      const connected = await this.connect();
      if (!connected) {
        return;
      }
    }

    // Send frame to Hume
    const message = {
      models: {
        face: {
          identify_faces: false,
          fps_pred: 3,
          prob_threshold: 0.8,
          min_face_size: 60,
        },
      },
      data: imageData,
    };

    try {
      this.ws?.send(JSON.stringify(message));
      this.resetConnectionTimeout();
    } catch (error) {
      console.error("Hume AI: Failed to send frame", error);
    }
  }

  /**
   * Handle incoming Hume AI message
   */
  private handleMessage(data: HumeAnalysisResult & { face?: { predictions: Array<{ emotions: HumeEmotionScore[] }> } }): void {
    if (data.face?.predictions && data.face.predictions.length > 0) {
      const emotions = data.face.predictions[0].emotions;
      const result = this.processEmotions(emotions);
      this.onResultCallback?.(result);
    }
  }

  /**
   * Process raw Hume emotions into application format
   */
  private processEmotions(emotions: HumeEmotionScore[]): ProcessedEmotionResult {
    const painLevel = calculatePainLevel(emotions);
    const distress = calculateDistressLevel(emotions);
    const anxiety = emotions.find(e => e.name === "Anxiety")?.score ?? 0;
    const confusion = emotions.find(e => e.name === "Confusion")?.score ?? 0;
    const anger = emotions.find(e => e.name === "Anger")?.score ?? 0;
    
    const topEmotions = getTopEmotions(emotions, 5);
    const primaryEmotion = topEmotions[0];
    const medicalCategory = getMedicalEmotionCategory(emotions);
    
    return {
      painLevel,
      distress,
      anxiety,
      confusion,
      anger,
      primaryEmotion: primaryEmotion?.name ?? "Unknown",
      primaryEmotionScore: primaryEmotion?.score ?? 0,
      category: medicalCategory.category,
      categoryLabel: medicalCategory.label,
      topEmotions,
      rawEmotions: emotions,
      confidence: medicalCategory.confidence,
      timestamp: Date.now(),
      source: "hume",
    };
  }

  /**
   * Set callback for emotion results
   */
  onResult(callback: (result: ProcessedEmotionResult) => void): void {
    this.onResultCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for status updates
   */
  onStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback;
  }
}

// Singleton instance
let humeServiceInstance: HumeService | null = null;

/**
 * Get the Hume service singleton
 */
export function getHumeService(): HumeService {
  if (!humeServiceInstance) {
    humeServiceInstance = new HumeService();
  }
  return humeServiceInstance;
}

/**
 * Capture frame from video element as base64
 */
export function captureFrameAsBase64(video: HTMLVideoElement): string | null {
  if (!video || video.readyState < 2) return null;
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    
    // Get base64 without the data:image/jpeg;base64, prefix
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return dataUrl.split(",")[1];
  } catch (error) {
    console.error("Failed to capture frame:", error);
    return null;
  }
}
