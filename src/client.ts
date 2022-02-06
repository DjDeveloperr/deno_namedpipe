import {
  CancelIoEx,
  CloseHandle,
  CreateFileA,
  DisconnectNamedPipe,
  FILE_FLAG_OVERLAPPED,
  GENERIC_READ,
  GENERIC_WRITE,
  HANDLE,
  OPEN_EXISTING,
  Overlapped,
  PeekNamedPipe,
  ReadFile,
  WriteFile,
} from "./winapi.ts";

/**
 * Represents a Named Pipe (client) connection.
 *
 * Partially implements the `Deno.Conn` interface with a few caveats:
 *
 * - `rid` is not a Deno resource table ID, but WinAPI HANDLE.
 * - `closeWrite` is not implemented and throws when used.
 *
 * Do not construct directly, use `open` function instead.
 */
export class NamedPipe implements Deno.Conn {
  #closed = false;

  constructor(
    public name: string,
    private handle: HANDLE,
    private isServerConn = false,
  ) {}

  get localAddr(): Deno.Addr {
    return this.remoteAddr;
  }

  get remoteAddr(): Deno.Addr {
    return {
      transport: "win32" as Deno.UnixAddr["transport"],
      path: this.name,
    };
  }

  get rid() {
    return Number(this.handle.value);
  }

  closeWrite(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  peek(into?: Uint8Array) {
    this.#checkClosed();

    const bytesRead = new Uint32Array(1);
    const totalBytesAvail = new Uint32Array(1);
    const bytesLeftThisMessage = new Uint32Array(1);

    PeekNamedPipe(
      this.handle,
      into ?? null,
      bytesRead,
      totalBytesAvail,
      bytesLeftThisMessage,
    );
    return {
      bytesRead: bytesRead[0],
      totalBytesAvailable: totalBytesAvail[0],
      bytesLeftThisMessage: bytesLeftThisMessage[0],
    };
  }

  #pending = new Set<Overlapped>();

  async write(data: Uint8Array) {
    this.#checkClosed();

    const overlapped = new Overlapped(this.handle);
    WriteFile(
      this.handle,
      data,
      data.length,
      overlapped.data,
    );

    this.#pending.add(overlapped);

    let write = await overlapped.getResult(true);
    while (overlapped.internal === 259n) {
      write = await overlapped.getResult(true);
    }

    this.#pending.delete(overlapped);

    return write;
  }

  async read(into: Uint8Array): Promise<number | null> {
    if (this.#closed) return null;

    const overlapped = new Overlapped(this.handle);
    ReadFile(
      this.handle,
      into,
      into.length,
      overlapped.data,
    );

    this.#pending.add(overlapped);

    await overlapped.getResult(true);
    while (overlapped.internal === 259n) {
      await overlapped.getResult(true);
    }

    this.#pending.delete(overlapped);

    return Number(overlapped.internalHigh);
  }

  #checkClosed() {
    if (this.#closed) throw new Error("NamedPipe is already closed");
  }

  close() {
    this.#checkClosed();
    for (const overlapped of this.#pending) {
      CancelIoEx(this.handle, overlapped.data);
    }
    if (this.isServerConn) DisconnectNamedPipe(this.handle);
    CloseHandle(this.handle);
    this.#closed = true;
  }

  setNoDelay(_: boolean) {
    throw new Error("Unimplemented");
  }

  setKeepAlive(_: boolean) {
    throw new Error("Unimplemented");
  }
}

/**
 * Connects to the given named pipe. Similar to `Deno.connect`,
 * since NamedPipe implements `Deno.Conn`, so you can safely
 * swap out `Deno.connect` for this `connect` to support Named
 * Pipe in place of Unix Sockets on Windows.
 *
 * @param name Named Pipe name. Example: `\\.\pipe\name-here`
 * @returns NamedPipe Client instance
 */
export async function connect(name: string) {
  return new NamedPipe(
    name,
    await CreateFileA(
      name,
      GENERIC_READ | GENERIC_WRITE,
      0,
      OPEN_EXISTING,
      FILE_FLAG_OVERLAPPED,
    ),
  );
}
