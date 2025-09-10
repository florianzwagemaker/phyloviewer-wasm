export function parseTsv(tsv: string): Record<string, string>[] {
  const lines = tsv.trim().split('\n');
  const headers = lines[0].split('\t');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length === headers.length) {
      const entry: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        entry[headers[j]] = values[j];
      }
      data.push(entry);
    }
  }

  return data;
}
