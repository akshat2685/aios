import fs from 'node:fs';
import path from 'node:path';

let wasmInstance: any = null;
let memory: any;
let __dataview: DataView;

export async function initWasm() {
  if (wasmInstance) return;

  let wasmPath = path.join(__dirname, '../build/release.wasm');
  if (!fs.existsSync(wasmPath)) {
    wasmPath = path.join(__dirname, '../../build/release.wasm');
  }
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  const adaptedImports = {
    env: {
      abort(message: number, fileName: number, lineNumber: number, columnNumber: number) {
        const msg = __liftString(message >>> 0);
        const file = __liftString(fileName >>> 0);
        throw Error(`${msg} in ${file}:${lineNumber >>> 0}:${columnNumber >>> 0}`);
      }
    }
  };

  const { instance } = await (globalThis as any).WebAssembly.instantiate(wasmBuffer, adaptedImports);
  wasmInstance = instance.exports;
  memory = (wasmInstance.memory || adaptedImports.env) as any;
  __dataview = new DataView(memory.buffer);
}

export function getSparseEmbeddingWasm(text: string): Float64Array {
  if (!wasmInstance) {
    throw new Error("Wasm module not initialized");
  }
  
  const textPtr = __lowerString(text);
  if (!textPtr) throw new Error("value must not be null");
  
  const resultPtr = wasmInstance.getSparseEmbedding(textPtr) >>> 0;
  return __liftTypedArray(Float64Array, resultPtr) as Float64Array;
}

function __liftString(pointer: number): string | null {
  if (!pointer) return null;
  const end = pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2] >>> 1;
  const memoryU16 = new Uint16Array(memory.buffer);
  let start = pointer >>> 1;
  let string = "";
  while (end - start > 1024) {
    string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
  }
  return string + String.fromCharCode(...memoryU16.subarray(start, end));
}

function __lowerString(value: string | null): number {
  if (value == null) return 0;
  const length = value.length;
  const pointer = wasmInstance.__new(length << 1, 2) >>> 0;
  const memoryU16 = new Uint16Array(memory.buffer);
  for (let i = 0; i < length; ++i) {
    memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
  }
  return pointer;
}

function __liftTypedArray(constructor: any, pointer: number) {
  if (!pointer) return null;
  return new constructor(
    memory.buffer,
    __getU32(pointer + 4),
    __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
  ).slice();
}

function __getU32(pointer: number): number {
  try {
    return __dataview.getUint32(pointer, true);
  } catch {
    __dataview = new DataView(memory.buffer);
    return __dataview.getUint32(pointer, true);
  }
}
