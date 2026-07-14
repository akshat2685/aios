export function getSparseEmbedding(text: string): Float64Array {
  let counts = new Map<i32, i32>();
  let len = text.length;
  let i = 0;

  while (i < len) {
    let start = i;
    while (start < len) {
      let c = text.charCodeAt(start);
      if (isWordChar(c)) break;
      start++;
    }
    if (start >= len) break;

    let end = start;
    while (end < len) {
      let c = text.charCodeAt(end);
      if (!isWordChar(c)) break;
      end++;
    }

    let tokenLen = end - start;
    if (tokenLen >= 2) {
      let hash: i32 = 5381;
      for (let j = start; j < end; j++) {
        let c = text.charCodeAt(j);
        // toLowerCase for A-Z
        if (c >= 65 && c <= 90) {
          c += 32;
        }
        hash = ((hash << 5) + hash) + c;
      }
      let idx: i32 = (hash < 0 ? -hash : hash) % 10000;
      let currentCount: i32 = counts.has(idx) ? counts.get(idx) : 0;
      counts.set(idx, currentCount + 1);
    }

    i = end;
  }

  let keys = counts.keys();
  let resultLen = keys.length;
  let result = new Float64Array(resultLen * 2);
  for (let k = 0; k < resultLen; k++) {
    let idx = keys[k];
    let count = counts.get(idx);
    result[k * 2] = f64(idx);
    result[k * 2 + 1] = Math.log10(f64(count + 1));
  }
  
  return result;
}

function isWordChar(c: i32): boolean {
  // a-z: 97-122
  // A-Z: 65-90
  // 0-9: 48-57
  // _: 95
  if (c >= 97 && c <= 122) return true;
  if (c >= 65 && c <= 90) return true;
  if (c >= 48 && c <= 57) return true;
  if (c == 95) return true;
  return false;
}
