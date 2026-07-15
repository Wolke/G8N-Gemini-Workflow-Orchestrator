import { describe, expect, it } from 'vitest';
import { inferRisk } from './index';

describe('inferRisk', () => {
  it('uses safe defaults and detects dangerous verbs', () => {
    expect(inferRisk('search_files')).toBe('read');
    expect(inferRisk('create_draft')).toBe('draft');
    expect(inferRisk('send_message')).toBe('send');
    expect(inferRisk('delete_event')).toBe('delete');
  });
});
