if (Deno.build.os === "windows") {
  var lib = Deno.dlopen("C:\\Windows\\System32\\Kernel32.dll", {
    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    CreateFileA: {
      nonblocking: true,
      parameters: [
        "pointer", /* lpFileName */
        "u32", /* dwDesiredAccess */
        "u32", /* dwShareMode */
        "pointer", /* lpSecurityAttributes */
        "u32", /* dwCreationDisposition */
        "u32", /* dwFlagsAndAttributes */
        "pointer", /* hTemplateFile */
      ],
      result: "pointer",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-peeknamedpipe
    PeekNamedPipe: {
      parameters: [
        "pointer", /* hNamedPipe */
        "pointer", /* lpBuffer */
        "u32", /* nBufferSize */
        "pointer", /* lpBytesRead */
        "pointer", /* lpTotalBytesAvail */
        "pointer", /* lpBytesLeftThisMessage */
      ],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle
    CloseHandle: {
      parameters: ["pointer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-disconnectnamedpipe
    DisconnectNamedPipe: {
      parameters: ["pointer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile
    WriteFile: {
      // nonblocking: true,
      parameters: [
        "pointer", /* hFile */
        "pointer", /* lpBuffer */
        "u32", /* nNumberOfBytesToWrite */
        "pointer", /* lpNumberOfBytesWritten */
        "pointer", /* lpOverlapped */
      ],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile
    ReadFile: {
      // In Overlapped IO, Read returns immediately, and the completion
      // is signaled by the OVERLAPPED structure.
      // nonblocking: true,
      parameters: ["pointer", "pointer", "u32", "pointer", "pointer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea
    CreateNamedPipeA: {
      // nonblocking: true,
      parameters: [
        "pointer", /* lpName */
        "u32", /* dwOpenMode */
        "u32", /* dwPipeMode */
        "u32", /* nMaxInstances */
        "u32", /* nOutBufferSize */
        "u32", /* nInBufferSize */
        "u32", /* nDefaultTimeOut */
        "pointer", /* lpSecurityAttributes */
      ],
      result: "pointer",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-connectnamedpipe
    ConnectNamedPipe: {
      nonblocking: true,
      parameters: ["pointer", "pointer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getoverlappedresult
    GetOverlappedResult: {
      nonblocking: true,
      parameters: ["pointer", "pointer", "pointer", "u8"],
      result: "i32",
    },

    CancelIoEx: {
      parameters: ["pointer", "pointer"],
      result: "i32",
    },

    GetLastError: {
      parameters: [],
      result: "u32",
    },

    FormatMessageA: {
      parameters: [
        "u32",
        "pointer",
        "u32",
        "u32",
        "pointer",
        "u32",
        "pointer",
      ],
      result: "i32",
    },
  });
}

function checkSupported() {
  if (typeof lib !== "object") {
    throw new Error(`deno_namedpipe only works on Windows.`);
  }
}

function cstr(str: string) {
  const res = new Uint8Array(str.length + 1);
  res.set((Deno as any).core.encode(str));
  return res;
}

export const INVALID_HANDLE_VALUE = -1;
export const GENERIC_READ = 0x80000000;
export const GENERIC_WRITE = 0x40000000;
export const GENERIC_EXECUTE = 0x20000000;
export const OPEN_EXISTING = 3;
export const FILE_FLAG_OVERLAPPED = 0x40000000;
export const PIPE_ACCESS_DUPLEX = 0x00000003;
export const PIPE_ACCESS_INBOUND = 0x00000001;
export const PIPE_ACCESS_OUTBOUND = 0x00000002;
export const FILE_FLAG_FIRST_PIPE_INSTANCE = 0x00080000;
export const FILE_FLAG_WRITE_THROUGH = 0x80000000;
export const WRITE_DAC = 0x00040000;
export const WRITE_OWNER = 0x00080000;
export const ACCESS_SYSTEM_SECURITY = 0x01000000;
export const PIPE_TYPE_BYTE = 0x00000000;
export const PIPE_TYPE_MESSAGE = 0x00000004;
export const PIPE_READMODE_BYTE = 0x00000000;
export const PIPE_READMODE_MESSAGE = 0x00000002;
export const PIPE_WAIT = 0x00000000;
export const PIPE_NOWAIT = 0x00000001;
export const PIPE_ACCEPT_REMOTE_CLIENTS = 0x00000000;
export const PIPE_REJECT_REMOTE_CLIENTS = 0x00000008;
export const PIPE_UNLIMITED_INSTANCES = 255;

export type HANDLE = Deno.UnsafePointer;

export async function CreateFileA(
  lpFileName: string,
  dwDesiredAccess: number,
  dwShareMode: number,
  dwCreationDisposition: number,
  dwFlagsAndAttributes: number,
) {
  checkSupported();
  const handle = (await lib.symbols.CreateFileA(
    cstr(lpFileName),
    dwDesiredAccess >>> 0,
    dwShareMode >>> 0,
    new Deno.UnsafePointer(0n),
    dwCreationDisposition >>> 0,
    dwFlagsAndAttributes >>> 0,
    new Deno.UnsafePointer(0n),
  )) as HANDLE;
  if (handle.value === BigInt(INVALID_HANDLE_VALUE)) {
    throw new Error(`CreateFileA failed`);
  }
  return handle;
}

export function PeekNamedPipe(
  hNamedPipe: HANDLE,
  lpBuffer: Uint8Array | null,
  lpBytesRead: Uint32Array,
  lpTotalBytesAvail: Uint32Array,
  lpBytesLeftThisMessage: Uint32Array,
) {
  checkSupported();
  UnwrapError(
    lib.symbols.PeekNamedPipe(
      hNamedPipe,
      lpBuffer,
      (lpBuffer?.byteLength ?? 0) >>> 0,
      lpBytesRead,
      lpTotalBytesAvail,
      lpBytesLeftThisMessage,
    ),
  );
}

export function CloseHandle(handle: HANDLE) {
  checkSupported();
  UnwrapError(lib.symbols.CloseHandle(handle));
}

export function WriteFile(
  hFile: HANDLE,
  lpBuffer: Uint8Array,
  nNumberOfBytesToWrite: number,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  UnwrapError(
    lib.symbols.WriteFile(
      hFile,
      lpBuffer,
      nNumberOfBytesToWrite,
      new Deno.UnsafePointer(0n),
      lpOverlapped,
    ),
    [997],
  );
}

export function ReadFile(
  hFile: HANDLE,
  lpBuffer: Uint8Array,
  nNumberOfBytesToRead: number,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  UnwrapError(
    lib.symbols.ReadFile(
      hFile,
      lpBuffer,
      nNumberOfBytesToRead,
      new Deno.UnsafePointer(0n),
      lpOverlapped,
    ),
    [997],
  );
}

export async function GetOverlappedResult(
  hFile: HANDLE,
  lpOverlapped: Uint8Array,
  lpNumberOfBytesTransferred: Uint32Array,
  bWait: boolean = false,
) {
  checkSupported();
  return (await lib.symbols.GetOverlappedResult(
    hFile,
    lpOverlapped,
    lpNumberOfBytesTransferred,
    bWait ? 1 : 0,
  )) as number;
}

export class Overlapped {
  data = new Uint8Array(
    8 + /** ULONG_PTR Internal */
      8 + /** ULONG_PTR InternalHigh */
      8 + /** PVOID Pointer */
      8, /** HANDLE hEvent */
  );

  constructor(public handle: HANDLE) {}

  get internal(): bigint {
    return new BigUint64Array(this.data.buffer, 0, 1)[0];
  }

  get internalHigh(): bigint {
    return new BigUint64Array(this.data.buffer, 8, 1)[0];
  }

  async getResult(wait = false) {
    const bytesTransferred = new Uint32Array(1);

    const result = await GetOverlappedResult(
      this.handle,
      this.data,
      bytesTransferred,
      wait,
    );

    if (result !== 1) {
      throw new Error(`GetOverlappedResult failed`);
    }

    return bytesTransferred[0];
  }

  [Symbol.for("Deno.customInspect")]() {
    return `Overlapped { status: ${this.internal}, byteTransfer: ${this.internalHigh} }`;
  }
}

export function CreateNamedPipeA(
  lpName: string,
  dwOpenMode: number,
  dwPipeMode: number,
  nMaxInstances: number,
  nOutBufferSize: number,
  nInBufferSize: number,
  nDefaultTimeOut: number,
) {
  checkSupported();
  const handle = lib.symbols.CreateNamedPipeA(
    cstr(lpName),
    dwOpenMode >>> 0,
    dwPipeMode >>> 0,
    nMaxInstances >>> 0,
    nOutBufferSize >>> 0,
    nInBufferSize >>> 0,
    nDefaultTimeOut >>> 0,
    new Deno.UnsafePointer(0n),
  ) as HANDLE;
  if (handle.value === BigInt(INVALID_HANDLE_VALUE)) {
    throw new Error(`CreateNamedPipeA failed`);
  }
  return handle;
}

export async function ConnectNamedPipe(
  hNamedPipe: HANDLE,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  UnwrapError(
    await lib.symbols.ConnectNamedPipe(
      hNamedPipe,
      lpOverlapped,
    ),
  );
}

export function DisconnectNamedPipe(hNamedPipe: HANDLE) {
  checkSupported();
  UnwrapError(lib.symbols.DisconnectNamedPipe(hNamedPipe));
}

export function CancelIoEx(hFile: HANDLE, lpOverlapped: Uint8Array) {
  checkSupported();
  UnwrapError(lib.symbols.CancelIoEx(hFile, lpOverlapped));
}

export function GetLastError(): number {
  checkSupported();
  return lib.symbols.GetLastError() as number;
}

export function FormatMessage(errCode: number): string {
  checkSupported();

  const lpBufferPtr = new BigUint64Array(1);

  lib.symbols.FormatMessageA(
    0x00000100 | 0x00001000 | 0x00000200,
    null,
    errCode,
    0,
    lpBufferPtr,
    0,
    null,
  ) as number;

  const lpBufferView = new Deno.UnsafePointerView(
    new Deno.UnsafePointer(lpBufferPtr[0]),
  );
  return lpBufferView.getCString();
}

export function UnwrapError(result: unknown, exclude: number[] = []) {
  if (result === 0) {
    const lastError = GetLastError();
    if (lastError === 0 || exclude.includes(lastError)) return;
    const message = FormatMessage(lastError);
    throw new Error(`(${lastError}) ${message}`);
  }
}
