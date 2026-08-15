// ai.client.ts

import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
// import { DEFAULT_AI_TIMEOUT_MS, getMockExtractionResponse } from './ai.constants.js';
import type { AIExtractionRequest, AIExtractionResponse, AIDocumentInput } from './ai.types.js';
import { AIBackendError } from './ai.errors.js';

export class AIClient {
  /**
   * Calls the external AI Backend to extract documents.
   * If the backend is unavailable or fails, returns a deterministic mock payload.
   */
  static async extractDocuments(request: AIExtractionRequest): Promise<AIExtractionResponse> {
    const { operationId, documents } = request;

    if (!env.AI_BACKEND_URL) {
      logger.warn({ operationId }, 'AI_BACKEND_URL not configured');
      // return AIClient.generateMockResponse(documents);
    }

    try {
      const timeoutMs = env.AI_BACKEND_TIMEOUT || 180000; // 3 minutes default

      // The Python backend `/extract` endpoint currently only accepts a single file at a time.
      // So we must iterate over the documents and make concurrent requests.
      const extractionPromises = documents.map(async (doc) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          // 1. Fetch file from storage
          const fileResponse = await fetch(doc.url);
          if (!fileResponse.ok) {
            throw new Error(`Failed to fetch document ${doc.documentId} from storage`);
          }
          const blob = await fileResponse.blob();

          let extension = '';
          if (blob.type === 'application/pdf') {
            extension = '.pdf';
          } else if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
            extension = '.jpg';
          } else if (blob.type === 'image/png') {
            extension = '.png';
          } else {
            const match = doc.url.split('?')[0]?.match(/\.(pdf|jpg|jpeg|png)$/i);
            if (match) {
              extension = match[0].toLowerCase();
            }
          }

          const filename = `${doc.documentId}${extension}`;

          // 2. Prepare FormData for this single document
          const formData = new FormData();
          formData.append('operationId', operationId);
          formData.append('file', blob, filename);

          const headers: Record<string, string> = {};
          if (env.AI_BACKEND_API_KEY) {
            headers['Authorization'] = `Bearer ${env.AI_BACKEND_API_KEY}`;
          }

          // 3. Send to Python AI Engine
          const response = await fetch(`${env.AI_BACKEND_URL}/extract`, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            throw new AIBackendError(`Status: ${response.status} ${response.statusText}. Body: ${errorText}`);
          }

          const data = await response.json();
          
          return {
            documentId: doc.documentId,
            documentType: data.extracted_data?.document_type || data.auto_classified_as || 'unknown',
            confidence: 1.0, 
            fields: data.extracted_data || {},
          };

        } catch (err: any) {
          clearTimeout(timeoutId);
          logger.error({ documentId: doc.documentId, error: err.message }, 'Failed to extract single document');
          // Return a placeholder for failed documents so we don't fail the entire batch
          return {
            documentId: doc.documentId,
            documentType: 'unknown',
            confidence: 0.0,
            fields: {},
          };
        }
      });

      const extractedDocuments = await Promise.all(extractionPromises);
      logger.info({ operationId, count: extractedDocuments.length }, 'AI Backend batch extraction completed');

      const mappedResponse: AIExtractionResponse = {
        status: 'completed',
        documents: extractedDocuments
      };

      return mappedResponse;

    } catch (error: any) {
      logger.warn(
        { operationId, err_message: error.message, error: error },
        'AI Backend unavailable or failed.'
      );
      throw error;
    }
  }

  /**
   * Generates a deterministic mock response for frontend development.
   */
  // private static generateMockResponse(documents: AIDocumentInput[]): AIExtractionResponse {
  //   return {
  //     status: 'completed',
  //     documents: documents.map(doc => getMockExtractionResponse(doc.documentId)),
  //   };
  // }
}
