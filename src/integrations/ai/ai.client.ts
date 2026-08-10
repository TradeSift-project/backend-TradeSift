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
      const controller = new AbortController();
      const timeoutMs = env.AI_BACKEND_TIMEOUT || 60000; // 60 seconds default
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const formData = new FormData();
      formData.append('operationId', operationId);

      // Download each file and append to FormData
      for (const doc of documents) {
        try {
          const fileResponse = await fetch(doc.url);
          if (!fileResponse.ok) {
            logger.warn({ documentId: doc.documentId, url: doc.url }, 'Failed to fetch document for AI extraction');
            continue;
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
            // Fallback to extracting from URL if content-type is generic
            const match = doc.url.split('?')[0]?.match(/\.(pdf|jpg|jpeg|png)$/i);
            if (match) {
              extension = match[0].toLowerCase();
            }
          }

          const filename = `${doc.documentId}${extension}`;

          // Append with 'file' as the field name, as expected by the AI backend
          formData.append('file', blob, filename);
          logger.info({ documentId: doc.documentId }, 'Document fetched successfully');
        } catch (fetchErr: any) {
          logger.error({ documentId: doc.documentId, error: fetchErr.message }, 'Error fetching document from storage');
        }
      }

      const headers: Record<string, string> = {};

      if (env.AI_BACKEND_API_KEY) {
        headers['Authorization'] = `Bearer ${env.AI_BACKEND_API_KEY}`;
      }
      // Note: We do NOT set 'Content-Type': 'multipart/form-data'. 
      // fetch automatically sets it along with the correct boundary when the body is FormData.

      const response = await fetch(`${env.AI_BACKEND_URL}/extract`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        throw new AIBackendError(`AI Backend responded with status: ${response.status} ${response.statusText}. Body: ${errorText}`);
      }

      const data = await response.json();
      logger.info({ operationId, data }, 'AI Backend extraction completed');
      
      // Map the single document response to our internal format
      // Since the AI backend might not return our original documentId, 
      // we'll map it to the first document we uploaded!
      const originalDocId = documents[0]?.documentId || 'unknown';

      const mappedResponse: AIExtractionResponse = {
        status: data.status || 'completed',
        documents: [
          {
            documentId: originalDocId,
            documentType: data.extracted_data?.document_type || 'unknown',
            confidence: 1.0, // default if not provided
            fields: data.extracted_data || {},
          }
        ]
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
