export function extractXmlField(xml: string, fieldName: string): string | null {
  const regex = new RegExp(`<${fieldName}>([\\s\\S]*?)</${fieldName}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

export function summarizeJobConfig(xml: string): string {
  const description = extractXmlField(xml, 'description') ?? '(none)';
  const disabled = extractXmlField(xml, 'disabled') ?? 'false';
  const lines = [`Description: ${description}`, `Disabled: ${disabled}`];

  if (xml.includes('<scm')) {
    const scmUrl = extractXmlField(xml, 'url');
    if (scmUrl) lines.push(`SCM URL: ${scmUrl}`);
  }

  if (xml.includes('<triggers>')) {
    lines.push('Has triggers: yes');
  }

  return lines.join('\n');
}
