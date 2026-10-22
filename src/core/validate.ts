import type { ParsedMessage } from './types'
import { parseMessage } from './parse'
import { isBlank } from './text'

export const DEFAULT_MAX_LENGTH = 4096

export type ValidationErrorCode = 'EMPTY_MESSAGE' | 'TOO_LONG'

export interface ValidationError {
  readonly code: ValidationErrorCode
  /** English fallback message. Apps should translate by `code`. */
  readonly message: string
  readonly limit?: number
  readonly actual?: number
}

export interface ValidationOptions {
  /**
   * Maximum visible length in UTF-16 code units (the same unit as JavaScript
   * strings and Telegram entities). `null` disables the limit.
   * Default: 4096.
   */
  readonly maxLength?: number | null
  /** Allow a message with no visible characters. Default: false. */
  readonly allowEmpty?: boolean
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly ValidationError[]
  readonly text: string
  readonly length: number
  readonly isEmpty: boolean
  readonly document: ParsedMessage
}

/**
 * Validates an already parsed message. Use this when you also render the
 * message, so the parser runs only once.
 */
export function validateDocument(
  document: ParsedMessage,
  options: ValidationOptions = {},
): ValidationResult {
  const errors: ValidationError[] = []
  const isEmpty = isBlank(document.text)
  const maxLength = options.maxLength === undefined
    ? DEFAULT_MAX_LENGTH
    : options.maxLength
  const allowEmpty = options.allowEmpty === true

  if (!allowEmpty && isEmpty) {
    errors.push({
      code: 'EMPTY_MESSAGE',
      message: 'Message must contain at least one visible character.',
    })
  }

  if (maxLength !== null && document.text.length > maxLength) {
    errors.push({
      code: 'TOO_LONG',
      message: 'Message is too long.',
      limit: maxLength,
      actual: document.text.length,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    text: document.text,
    length: document.text.length,
    isEmpty,
    document,
  }
}

/** Parses and validates a message in one call. */
export function validateMessage(
  source: string,
  options: ValidationOptions = {},
): ValidationResult {
  return validateDocument(parseMessage(source), options)
}
