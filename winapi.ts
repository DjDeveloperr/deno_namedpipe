export const NULL = 0;

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

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile
    WriteFile: {
      nonblocking: true,
      parameters: [
        "isize", /* hFile */
        "buffer", /* lpBuffer */
        "u32", /* nNumberOfBytesToWrite */
        "buffer", /* lpNumberOfBytesWritten */
        "usize", /* lpOverlapped */
      ],
      result: "i32",
    },

    // https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile
    ReadFile: {
      nonblocking: true,
      parameters: ["isize", "buffer", "u32", "buffer", "usize"],
      result: "i32",
    },
    // casting until FFI buffer support is on canary only
  } as Record<string, Deno.ForeignFunction>);
} else {
  lib = undefined as any;
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

export const GENERIC_READ = 0x80000000;
export const GENERIC_WRITE = 0x40000000;
export const GENERIC_EXECUTE = 0x20000000;
export const OPEN_EXISTING = 3;
export const FILE_FLAG_OVERLAPPED = 0x40000000;

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
  if (handle < 0) throw new Error(`CreateFileA failed`);
  return handle;
}

export async function PeekNamedPipe(
  hNamedPipe: number,
  lpBuffer: Uint8Array | null,
  lpBytesRead: Uint8Array | null,
  lpTotalBytesAvail: Uint8Array,
  lpBytesLeftThisMessage: Uint8Array | null,
) {
  checkSupported();
  return (await lib.symbols.PeekNamedPipe(
    hNamedPipe,
    lpBuffer ?? NULL,
    lpBuffer === null ? NULL : lpBuffer.byteLength >>> 0,
    lpBytesRead ?? NULL,
    lpTotalBytesAvail,
    lpBytesLeftThisMessage ?? NULL,
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
  lpNumberOfBytesWritten: Uint8Array | null,
  lpOverlapped: Uint8Array | null,
) {
  checkSupported();
  return (await lib.symbols.WriteFile(
    hFile,
    lpBuffer,
    nNumberOfBytesToWrite,
    lpNumberOfBytesWritten ?? NULL,
    lpOverlapped ?? NULL,
  )) as number;
}

export async function ReadFile(
  hFile: number,
  lpBuffer: Uint8Array,
  nNumberOfBytesToRead: number,
  lpNumberOfBytesRead: Uint8Array | null,
  lpOverlapped: Uint8Array | null,
) {
  checkSupported();
  return (await lib.symbols.ReadFile(
    hFile,
    lpBuffer,
    nNumberOfBytesToRead,
    lpNumberOfBytesRead ?? NULL,
    lpOverlapped ?? NULL,
  )) as number;
}
