import { describe, it, expect } from 'vitest';
import { extractXmlField, summarizeJobConfig } from '../src/utils/xml.js';

describe('extractXmlField', () => {
  it('extracts a field value', () => {
    const xml = '<project><description>My job</description></project>';
    expect(extractXmlField(xml, 'description')).toBe('My job');
  });

  it('returns null for missing field', () => {
    const xml = '<project></project>';
    expect(extractXmlField(xml, 'description')).toBeNull();
  });

  it('handles multiline content', () => {
    const xml = '<project><description>\n  Multi\n  Line\n</description></project>';
    expect(extractXmlField(xml, 'description')).toBe('Multi\n  Line');
  });
});

describe('summarizeJobConfig', () => {
  it('summarizes basic config', () => {
    const xml = '<project><description>Web API</description><disabled>false</disabled></project>';
    const summary = summarizeJobConfig(xml);
    expect(summary).toContain('Description: Web API');
    expect(summary).toContain('Disabled: false');
  });

  it('shows SCM URL if present', () => {
    const xml =
      '<project><description>test</description><disabled>false</disabled><scm><url>https://github.com/test/repo</url></scm></project>';
    const summary = summarizeJobConfig(xml);
    expect(summary).toContain('SCM URL: https://github.com/test/repo');
  });

  it('shows triggers if present', () => {
    const xml =
      '<project><description>test</description><disabled>false</disabled><triggers><trigger/></triggers></project>';
    const summary = summarizeJobConfig(xml);
    expect(summary).toContain('Has triggers: yes');
  });

  it('handles missing description', () => {
    const xml = '<project><disabled>true</disabled></project>';
    const summary = summarizeJobConfig(xml);
    expect(summary).toContain('Description: (none)');
  });
});
