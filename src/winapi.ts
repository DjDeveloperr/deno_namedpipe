if (Deno.build.os === "windows") {
  var lib = Deno.dlopen("C:\\Windows\\System32\\Kernel32.dll", {
    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    CreateFileA: {
      nonblocking: true,
      parameters: [
        "buffer", /* lpFileName */
        "u32", /* dwDesiredAccess */
        "u32", /* dwShareMode */
        "usize", /* lpSecurityAttributes */
        "u32", /* dwCreationDisposition */
        "u32", /* dwFlagsAndAttributes */
        "usize", /* hTemplateFile */
      ],
      result: "isize",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-peeknamedpipe
    PeekNamedPipe: {
      nonblocking: true,
      parameters: [
        "isize", /* hNamedPipe */
        "buffer", /* lpBuffer */
        "u32", /* nBufferSize */
        "buffer", /* lpBytesRead */
        "buffer", /* lpTotalBytesAvail */
        "buffer", /* lpBytesLeftThisMessage */
      ],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle
    CloseHandle: {
      parameters: ["isize"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-disconnectnamedpipe
    DisconnectNamedPipe: {
      parameters: ["isize"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile
    WriteFile: {
      nonblocking: true,
      parameters: [
        "isize", /* hFile */
        "buffer", /* lpBuffer */
        "u32", /* nNumberOfBytesToWrite */
        "usize", /* lpNumberOfBytesWritten */
        "buffer", /* lpOverlapped */
      ],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile
    ReadFile: {
      nonblocking: true,
      parameters: ["isize", "buffer", "u32", "usize", "buffer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea
    CreateNamedPipeA: {
      // nonblocking: true,
      parameters: [
        "buffer", /* lpName */
        "u32", /* dwOpenMode */
        "u32", /* dwPipeMode */
        "u32", /* nMaxInstances */
        "u32", /* nOutBufferSize */
        "u32", /* nInBufferSize */
        "u32", /* nDefaultTimeOut */
        "usize", /* lpSecurityAttributes */
      ],
      result: "isize",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-connectnamedpipe
    ConnectNamedPipe: {
      nonblocking: true,
      parameters: ["isize", "buffer"],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getoverlappedresult
    GetOverlappedResult: {
      nonblocking: true,
      parameters: ["isize", "buffer", "buffer", "u8"],
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

export async function CreateFileA(
  lpFileName: string,
  dwDesiredAccess: number,
  dwShareMode: number,
  lpSecurityAttributes: number,
  dwCreationDisposition: number,
  dwFlagsAndAttributes: number,
  hTemplateFile: number,
) {
  checkSupported();
  const handle = (await lib.symbols.CreateFileA(
    cstr(lpFileName),
    dwDesiredAccess >>> 0,
    dwShareMode >>> 0,
    lpSecurityAttributes,
    dwCreationDisposition >>> 0,
    dwFlagsAndAttributes >>> 0,
    hTemplateFile,
  )) as number;
  if (handle === INVALID_HANDLE_VALUE) throw new Error(`CreateFileA failed`);
  return handle;
}

export async function PeekNamedPipe(
  hNamedPipe: number,
  lpBuffer: Uint8Array,
  lpBytesRead: Uint8Array,
  lpTotalBytesAvail: Uint8Array,
  lpBytesLeftThisMessage: Uint8Array,
) {
  checkSupported();
  return (await lib.symbols.PeekNamedPipe(
    hNamedPipe,
    lpBuffer,
    lpBuffer.byteLength >>> 0,
    lpBytesRead,
    lpTotalBytesAvail,
    lpBytesLeftThisMessage,
  )) as number;
}

export function CloseHandle(handle: number) {
  checkSupported();
  return lib.symbols.CloseHandle(handle) as number;
}

export async function WriteFile(
  hFile: number,
  lpBuffer: Uint8Array,
  nNumberOfBytesToWrite: number,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  return (await lib.symbols.WriteFile(
    hFile,
    lpBuffer,
    nNumberOfBytesToWrite,
    0,
    lpOverlapped,
  )) as number;
}

export async function ReadFile(
  hFile: number,
  lpBuffer: Uint8Array,
  nNumberOfBytesToRead: number,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  return (await lib.symbols.ReadFile(
    hFile,
    lpBuffer,
    nNumberOfBytesToRead,
    0,
    lpOverlapped,
  )) as number;
}

export async function GetOverlappedResult(
  hFile: number,
  lpOverlapped: Uint8Array,
  lpNumberOfBytesTransferred: Uint8Array,
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

  constructor(public handle: number) {}

  get internal(): bigint {
    return new BigUint64Array(this.data.buffer, 0, 1)[0];
  }

  get internalHigh(): bigint {
    return new BigUint64Array(this.data.buffer, 8, 1)[0];
  }

  async getResult(wait = false) {
    const bytesTransferred = new Uint8Array(4);

    const result = await GetOverlappedResult(
      this.handle,
      this.data,
      bytesTransferred,
      wait,
    );

    if (result !== 1) {
      throw new Error(`GetOverlappedResult failed`);
    }

    return new Uint32Array(bytesTransferred.buffer)[0];
  }

  [Symbol.for("Deno.customInspect")]() {
    return `Overlapped(Status: ${this.internal}, ByteTransfer: ${this.internalHigh})`;
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
  lpSecurityAttributes = 0,
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
    lpSecurityAttributes,
  ) as number;
  if (handle === INVALID_HANDLE_VALUE) {
    throw new Error(`CreateNamedPipeA failed`);
  }
  return handle;
}

export async function ConnectNamedPipe(
  hNamedPipe: number,
  lpOverlapped: Uint8Array,
) {
  checkSupported();
  return (await lib.symbols.ConnectNamedPipe(
    hNamedPipe,
    lpOverlapped,
  )) as number;
}

export function DisconnectNamedPipe(hNamedPipe: number) {
  checkSupported();
  return lib.symbols.DisconnectNamedPipe(hNamedPipe) as number;
}
