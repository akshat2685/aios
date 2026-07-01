export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export function chunkText(text: string, options: ChunkingOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 500;
  const chunkOverlap = options.chunkOverlap ?? 50;

  if (chunkSize <= 0) return [text];
  if (text.length <= chunkSize) return [text];

  const separators = ['\n\n', '\n', ' ', ''];
  const chunks: string[] = [];

  function split(txt: string, separatorIdx: number) {
    if (txt.length <= chunkSize) {
      chunks.push(txt);
      return;
    }

    const separator = separators[separatorIdx];
    let parts: string[];
    if (separator === '') {
      parts = txt.split('');
    } else {
      parts = txt.split(separator);
    }

    let currentChunk = '';
    for (const part of parts) {
      const joint = separator === '' ? '' : separator;
      const candidate = currentChunk ? currentChunk + joint + part : part;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          // Calculate overlap
          const words = currentChunk.split(joint);
          let overlapStr = '';
          for (let i = words.length - 1; i >= 0; i--) {
            const nextCandidate = words.slice(i).join(joint);
            if (nextCandidate.length <= chunkOverlap) {
              overlapStr = nextCandidate;
            } else {
              break;
            }
          }
          currentChunk = overlapStr ? overlapStr + joint + part : part;
        } else {
          // The part itself is larger than chunkSize, we must split it by the next separator
          if (separatorIdx < separators.length - 1) {
            split(part, separatorIdx + 1);
          } else {
            // No more separators, just slice it
            let start = 0;
            while (start < part.length) {
              chunks.push(part.slice(start, start + chunkSize));
              start += chunkSize - chunkOverlap;
            }
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  split(text, 0);
  return chunks.filter(c => c.trim().length > 0);
}
