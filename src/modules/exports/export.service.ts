// export.service.ts

import type { Buffer } from 'node:buffer';
import { ApiError } from '../../common/ApiError.js';
import { verifyExtractionOwnership } from '../extractions/extraction.service.js';
import { findExtractionsByOperationId } from '../extractions/extraction.repository.js';
import { findOperationById } from '../operations/operation.repository.js';
import { updateExtractionExportStats } from './export.repository.js';
import { generateExtractionWorkbook } from '../../integrations/excel/excel.service.js';
import logger from '../../config/logger.js';

export const exportExtractionToExcel = async (
  userId: string,
  extractionId: string
): Promise<{ buffer: Buffer; filename: string }> => {
  logger.info({ extractionId }, 'Export requested');

  // Verify extraction exists and belongs to the user via parent operation
  const extraction = await verifyExtractionOwnership(userId, extractionId);

  // Business rule: Only APPROVED extractions can be exported in Phase 7
  if (extraction.status !== 'APPROVED') {
    logger.warn({ extractionId, status: extraction.status }, 'Export failed: Extraction not approved');
    throw new ApiError(409, 'Only APPROVED extractions can be exported.');
  }

  // Use originalFields and override with any editedFields
  const exportData = {
    ...((extraction.originalFields || {}) as Record<string, any>),
    ...((extraction.editedFields || {}) as Record<string, any>)
  };

  // Generate the workbook
  const buffer = await generateExtractionWorkbook({ fields: exportData });
  logger.info({ extractionId }, 'Workbook generated');

  // Update export stats
  await updateExtractionExportStats(extractionId);

  const filename = `TradeSift_Extraction_${extractionId}.xlsx`;

  return { buffer, filename };
};

export const exportOperationToExcel = async (
  userId: string,
  operationId: string
): Promise<{ buffer: Buffer; filename: string }> => {
  logger.info({ operationId }, 'Operation export requested');

  const operation = await findOperationById(operationId);
  if (!operation) {
    throw new ApiError(404, 'Operation not found.');
  }
  if (operation.userId !== userId) {
    throw new ApiError(403, 'Unauthorized operation.');
  }

  const extractions = await findExtractionsByOperationId(operationId);
  const approvedExtractions = extractions.filter(ext => ext.status === 'APPROVED');

  if (approvedExtractions.length === 0) {
    throw new ApiError(409, 'Export failed: No approved extractions found for this operation.');
  }

  // Combine fields if multiple extractions exist
  let exportData: Record<string, any> = {};
  
  if (approvedExtractions.length === 1) {
    const ext = approvedExtractions[0];
    if (ext) {
      exportData = {
        ...((ext.originalFields || {}) as Record<string, any>),
        ...((ext.editedFields || {}) as Record<string, any>)
      };
    }
  } else {
    approvedExtractions.forEach((ext, i) => {
      const data = {
        ...((ext.originalFields || {}) as Record<string, any>),
        ...((ext.editedFields || {}) as Record<string, any>)
      };
      exportData[`Document_${i + 1}_${ext.documentType}`] = data;
    });
  }

  const buffer = await generateExtractionWorkbook({ fields: exportData });
  logger.info({ operationId }, 'Operation workbook generated');

  // Update export stats for all approved extractions
  await Promise.all(approvedExtractions.map(ext => updateExtractionExportStats(ext.id)));

  const ref = operation.referenceNo ? operation.referenceNo.replace(/[^a-zA-Z0-9_-]/g, '_') : operationId;
  const filename = `TradeSift_${ref}.xlsx`;

  return { buffer, filename };
};
