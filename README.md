# deno_namedpipe

Asynchronous Named Pipes support for Deno, built on WinAPI using FFI.

## Usage

```ts
const conn = await connect("\\\\?\\pipe\\{name}");
// use conn
```

`connect` function which returns `NamedPipe` partially implements `Deno.Conn`
but for Named Pipes. API will be same as `Deno.connect` except `closeWrite` not
being implemented and `rid` being the File Handle (instead of Resource ID).

This module also needs `--unstable` flag because it uses the new FFI feature to
call WinAPI.

## Why?

I know you can open a Windows Named Pipe in Deno using `Deno.open` and
read/write on it, but Deno's File implementation has a problem: if your read
operation or write operation has not yet resolved, it'll block any further
read/write operation on the file which limits the usecase I had.

## License

Apache-2.0 licensed. Check [LICENSE](./LICENSE) for more info.

Copyright 2022 © DjDeveloperr
