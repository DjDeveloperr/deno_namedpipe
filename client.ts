import {
  Foundation,
  OverlappedPromise,
  Pipes,
  Storage,
  unwrap,
} from "./deps.ts";

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
    private handle: Deno.PointerValue,
    private isServerConn = false,
  ) {
    unwrap(Number(handle));
  }

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
    return Number(this.handle);
  }

  closeWrite(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  peek(into?: Uint8Array) {
    this.#checkClosed();

    const bytesRead = new Uint32Array(1);
    const totalBytesAvail = new Uint32Array(1);
    const bytesLeftThisMessage = new Uint32Array(1);

    unwrap(Pipes.PeekNamedPipe(
      this.handle,
      into ?? null,
      into?.length ?? 0,
      new Uint8Array(bytesRead.buffer),
      new Uint8Array(totalBytesAvail.buffer),
      new Uint8Array(bytesLeftThisMessage.buffer),
    ));
    return {
      bytesRead: bytesRead[0],
      totalBytesAvailable: totalBytesAvail[0],
      bytesLeftThisMessage: bytesLeftThisMessage[0],
    };
  }

  #pending = new Set<AbortController>();

  async write(data: Uint8Array) {
    this.#checkClosed();

    const controller = new AbortController();
    const overlapped = new OverlappedPromise(this.handle, controller.signal);
    unwrap(Storage.WriteFile(
      this.handle,
      data,
      data.length,
      null,
      overlapped.buffer,
    ));

    this.#pending.add(controller);

    return await overlapped.catch((_) => 0).finally(() => {
      this.#pending.delete(controller);
    });
  }

  async read(into: Uint8Array): Promise<number | null> {
    if (this.#closed) return null;

    const controller = new AbortController();
    const overlapped = new OverlappedPromise(this.handle, controller.signal);
    unwrap(Storage.ReadFile(
      this.handle,
      into,
      into.byteLength,
      null,
      overlapped.buffer,
    ));

    this.#pending.add(controller);

    return await overlapped.catch((_) => 0).finally(() => {
      this.#pending.delete(controller);
    });
  }

  #checkClosed() {
    if (this.#closed) throw new Error("NamedPipe is already closed");
  }

  close() {
    this.#checkClosed();
    for (const sig of this.#pending) {
      sig.abort("NamedPipe closed");
    }
    if (this.isServerConn) Pipes.DisconnectNamedPipe(this.handle);
    Foundation.CloseHandle(this.handle);
    this.#closed = true;
  }

  setNoDelay(_?: boolean) {
    throw new Error("Unimplemented");
  }

  setKeepAlive(_?: boolean) {
    throw new Error("Unimplemented");
  }

  #tryClose() {
    try {
      this.close();
    } catch (_) {
      // do nothing
    }
  }

  get readable() {
    // deno-lint-ignore no-this-alias
    const scope = this;
    return new ReadableStream({
      type: "bytes",
      async pull(ctx) {
        const v = ctx.byobRequest!.view as Uint8Array;
        try {
          const n = await scope.read(v);
          if (n === null) {
            scope.#tryClose();
            ctx.close();
            ctx.byobRequest!.respond(0);
          } else {
            ctx.byobRequest!.respond(n);
          }
        } catch (e) {
          ctx.error(e);
          scope.#tryClose();
        }
      },
      cancel() {
        scope.#tryClose();
      },
      autoAllocateChunkSize: 16_640,
    });
  }

  get writable() {
    // deno-lint-ignore no-this-alias
    const scope = this;
    return new WritableStream({
      async write(chunk, ctx) {
        try {
          let written = 0;
          while (written < chunk.length) {
            written += await scope.write(chunk.subarray(written));
          }
        } catch (e) {
          ctx.error(e);
          scope.#tryClose();
        }
      },
      close() {
        scope.#tryClose();
      },
      abort() {
        scope.#tryClose();
      },
    });
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
    (await Storage.CreateFileAAsync(
      name,
      (Storage.FILE_GENERIC_READ | Storage.FILE_GENERIC_WRITE) >>> 0,
      0,
      0,
      Storage.OPEN_EXISTING >>> 0,
      Storage.FILE_FLAG_OVERLAPPED >>> 0,
      null,
    ))!,
  );
}
