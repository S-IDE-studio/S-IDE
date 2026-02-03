/**
 * Validation Utilities
 *
 * Common validation functions for API routes
 */

import { createHttpError } from "./error.js";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a required string field
 */
export function validateRequiredString(value: unknown, fieldName: string): string {
  if (value === undefined || value === null) {
    throw createHttpError(`${fieldName} is required`, 400);
  }
  if (typeof value !== "string") {
    throw createHttpError(`${fieldName} must be a string`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw createHttpError(`${fieldName} cannot be empty`, 400);
  }
  return trimmed;
}

/**
 * Validate an optional string field
 */
export function validateOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw createHttpError(`${fieldName} must be a string`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

/**
 * Validate a number field
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  if (value === undefined || value === null) {
    throw createHttpError(`${fieldName} is required`, 400);
  }
  if (typeof value !== "number") {
    throw createHttpError(`${fieldName} must be a number`, 400);
  }
  if (Number.isNaN(value)) {
    throw createHttpError(`${fieldName} must be a valid number`, 400);
  }
  if (options.min !== undefined && value < options.min) {
    throw createHttpError(`${fieldName} must be at least ${options.min}`, 400);
  }
  if (options.max !== undefined && value > options.max) {
    throw createHttpError(`${fieldName} must be at most ${options.max}`, 400);
  }
  return value;
}

/**
 * Validate a boolean field
 */
export function validateBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    throw createHttpError(`${fieldName} is required`, 400);
  }
  if (typeof value !== "boolean") {
    throw createHttpError(`${fieldName} must be a boolean`, 400);
  }
  return value;
}

/**
 * Validate an array field
 */
export function validateArray<T = unknown>(
  value: unknown,
  fieldName: string,
  itemType?: string
): T[] {
  if (value === undefined || value === null) {
    throw createHttpError(`${fieldName} is required`, 400);
  }
  if (!Array.isArray(value)) {
    throw createHttpError(`${fieldName} must be an array`, 400);
  }
  if (itemType && value.length > 0) {
    // Basic type check (can be extended)
    const valid = value.every((item) => typeof item === itemType.toLowerCase());
    if (!valid) {
      throw createHttpError(`${fieldName} must contain only ${itemType} values`, 400);
    }
  }
  return value as T[];
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): string {
  const length = value.length;
  if (options.min !== undefined && length < options.min) {
    throw createHttpError(`${fieldName} must be at least ${options.min} characters`, 400);
  }
  if (options.max !== undefined && length > options.max) {
    throw createHttpError(`${fieldName} must be at most ${options.max} characters`, 400);
  }
  return value;
}

/**
 * Validate string pattern
 */
export function validatePattern(
  value: string,
  fieldName: string,
  pattern: RegExp,
  errorMessage?: string
): string {
  if (!pattern.test(value)) {
    throw createHttpError(errorMessage || `${fieldName} contains invalid characters`, 400);
  }
  return value;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (value === undefined || value === null) {
    throw createHttpError(`${fieldName} is required`, 400);
  }
  if (typeof value !== "string") {
    throw createHttpError(`${fieldName} must be a string`, 400);
  }
  if (!allowedValues.includes(value as T)) {
    throw createHttpError(`${fieldName} must be one of: ${allowedValues.join(", ")}`, 400);
  }
  return value as T;
}
