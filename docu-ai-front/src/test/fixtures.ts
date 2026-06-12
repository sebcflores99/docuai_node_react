import type { Document, Message, User } from '../types';

// Shared fixtures for tests.

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    ownerId: 'user-1',
    title: 'France Facts',
    content: 'France is a country in Western Europe. Its capital is Paris.',
    status: 'READY',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeUserMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-user-1',
    conversationId: 'conv-1',
    role: 'USER',
    content: 'What is the capital of France?',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-assistant-1',
    conversationId: 'conv-1',
    role: 'ASSISTANT',
    content: 'The capital of France is Paris.',
    model: 'mock-model',
    promptTokens: 100,
    completionTokens: 20,
    sources: [
      {
        documentId: 'doc-1',
        documentTitle: 'France Facts',
        snippet: 'Its capital is Paris.',
        score: 0.87,
        page: '1',
      },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}
