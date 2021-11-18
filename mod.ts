import {
  CloseHandle,
  CreateFileA,
  FILE_FLAG_OVERLAPPED,
  GENERIC_READ,
  GENERIC_WRITE,
  NULL,
  OPEN_EXISTING,
  Overlapped,
  PeekNamedPipe,
  ReadFile,
  WriteFile,
} from "./winapi.ts";

export class NamedPipe implements Deno.Conn {
  #closed = false;

  constructor(public name: string, public handle: number) {}

  get localAddr(): Deno.Addr {
    return this.remoteAddr;
  }

  get remoteAddr(): Deno.Addr {
    return { transport: "unix", path: this.name };
  }

  get rid() {
    return this.handle;
  }

  closeWrite(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async peek(into?: Uint8Array) {
    this.#checkClosed();

    const bytesRead = into ? new Uint8Array(4) : null;
    const totalBytesAvail = new Uint8Array(4);
    const bytesLeftThisMessage = into ? new Uint8Array(4) : null;

    let res;
    if (
      (res = await PeekNamedPipe(
        this.handle,
        into ?? null,
        bytesRead,
        totalBytesAvail,
        bytesLeftThisMessage,
      ))
    ) {
      return {
        bytesRead: bytesRead === null
          ? undefined
          : new Uint32Array(bytesRead.buffer)[0],
        totalBytesAvailable: new Uint32Array(totalBytesAvail.buffer)[0],
        bytesLeftThisMessage: bytesLeftThisMessage === null
          ? undefined
          : new Uint32Array(bytesLeftThisMessage.buffer)[0],
      };
    } else throw new Error(`Failed to Peek Named Pipe: ${res}`);
  }

  async write(data: Uint8Array) {
    this.#checkClosed();

    const overlapped = new Overlapped(this.handle);
    await WriteFile(
      this.handle,
      data,
      data.length,
      null,
      overlapped.data,
    );

    let write = await overlapped.getResult(true);
    while (overlapped.internal === 259n) {
      write = await overlapped.getResult(true);
    }

    return write;
  }

  async read(into: Uint8Array) {
    this.#checkClosed();

    try {
      const overlapped = new Overlapped(this.handle);
      await ReadFile(
        this.handle,
        into,
        into.length,
        new Uint8Array(4), // TODO: Replace with null once buffer arg becomes nullable
        overlapped.data,
      );

      let read = await overlapped.getResult(true);
      while (overlapped.internal === 259n) {
        read = await overlapped.getResult(true);
      }

      return read;
    } catch (e) {
      throw e;
    }
  }

  #checkClosed() {
    if (this.#closed) throw new Error("NamedPipe is already closed");
  }

  close() {
    this.#checkClosed();
    let res = CloseHandle(this.handle);
    if (res === 1) this.#closed = true;
    else throw new Error(`Failed to close NamedPipe: ${res}`);
  }
}

export async function connect(name: string) {
  return new NamedPipe(
    name,
    await CreateFileA(
      name,
      GENERIC_READ | GENERIC_WRITE,
      NULL,
      NULL,
      OPEN_EXISTING,
      FILE_FLAG_OVERLAPPED,
      NULL,
    ),
  );
}
