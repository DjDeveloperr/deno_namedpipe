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
    const bytesWritten = new Uint8Array(4);

    let res;
    if (
      (res = await WriteFile(
        this.handle,
        data,
        data.length,
        bytesWritten,
        null,
      ))
    ) {
      return new Uint32Array(bytesWritten.buffer)[0];
    } else throw new Error(`Failed to write to NamedPipe: ${res}`);
  }

  async read(into: Uint8Array) {
    this.#checkClosed();

    const bytesRead = new Uint8Array(4);
    const overlapped = new Overlapped(this.handle);
    if (
      (await ReadFile(
        this.handle,
        into,
        into.length,
        bytesRead,
        overlapped.data,
      )) === 1
    ) {
      return new Uint32Array(bytesRead.buffer)[0];
    } else {
      return await overlapped.getResult(true);
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
