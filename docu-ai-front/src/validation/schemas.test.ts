import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  messageSchema,
  signupSchema,
  uploadSchema,
  validate,
} from './schemas';

describe('loginSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const r = validate(loginSchema, { email: 'a@b.com', password: 'x' });
    expect(r.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const r = validate(loginSchema, { email: 'nope', password: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.email).toBeDefined();
  });

  it('rejects an empty password', () => {
    const r = validate(loginSchema, { email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.password).toBeDefined();
  });
});

describe('signupSchema', () => {
  it('accepts matching passwords of sufficient length', () => {
    const r = validate(signupSchema, {
      email: 'a@b.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a short password', () => {
    const r = validate(signupSchema, {
      email: 'a@b.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.password).toMatch(/at least 8/);
  });

  it('flags mismatched confirmation on the confirmPassword field', () => {
    const r = validate(signupSchema, {
      email: 'a@b.com',
      password: 'password123',
      confirmPassword: 'different123',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.confirmPassword).toMatch(/do not match/);
  });
});

describe('uploadSchema', () => {
  function file(name: string, type: string, size = 10) {
    const f = new File(['x'.repeat(size)], name, { type });
    return f;
  }

  it('accepts a supported text file', () => {
    const r = validate(uploadSchema, { file: file('notes.txt', 'text/plain') });
    expect(r.success).toBe(true);
  });

  it('accepts by extension when the mime type is empty', () => {
    const r = validate(uploadSchema, { file: file('paper.pdf', '') });
    expect(r.success).toBe(true);
  });

  it('rejects an unsupported type', () => {
    const r = validate(uploadSchema, { file: file('pic.png', 'image/png') });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.file).toMatch(/Unsupported/);
  });

  it('rejects an empty file', () => {
    const r = validate(uploadSchema, { file: file('empty.txt', 'text/plain', 0) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.file).toMatch(/empty/);
  });

  it('rejects when no file is provided', () => {
    const r = validate(uploadSchema, { file: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.file).toBeDefined();
  });
});

describe('messageSchema', () => {
  it('trims and requires content', () => {
    expect(validate(messageSchema, { content: '   ' }).success).toBe(false);
    expect(validate(messageSchema, { content: 'hi' }).success).toBe(true);
  });
});
