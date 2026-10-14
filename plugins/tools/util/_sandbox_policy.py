import os
import runpy
import sys

WRITE_PREFIXES = ("/tmp/",)
DENY_READ_SUBSTR = (
    ".env",
    "database",
    "creds",
    "session",
    ".git",
    "node_modules",
    "package.json",
    "ecosystem.config",
    "opencode.json",
)


def _hook(event, args):
    if event in (
        "socket.getaddrinfo",
        "socket.gethostbyname",
        "socket.bind",
        "socket.connect",
        "socket.getnameinfo",
    ):
        raise RuntimeError("akses jaringan diblokir di sandbox publik")
    if event == "subprocess.Popen":
        raise RuntimeError("subprocess diblokir di sandbox publik")
    if event in (
        "os.system",
        "os.execv",
        "os.execve",
        "os.execl",
        "os.spawnl",
        "os.spawnlp",
        "os.posix_spawn",
        "os.posix_spawnp",
        "os.startfile",
        "os.fork",
        "os._exit",
    ):
        raise RuntimeError("eksekusi proses diblokir di sandbox publik")
    if event == "open":
        path = str(args[0]) if args else ""
        mode = str(args[1]) if len(args) > 1 else "r"
        low = path.lower()
        if any(s in low for s in DENY_READ_SUBSTR):
            raise RuntimeError("akses file sensitif diblokir di sandbox publik")
        if any(w in mode for w in ("w", "a", "x", "+")) and not path.startswith(WRITE_PREFIXES):
            raise RuntimeError("tulis file di luar /tmp diblokir di sandbox publik")


def main():
    if len(sys.argv) < 2:
        print("usage: policy.py <userfile>", file=sys.stderr)
        sys.exit(2)
    sys.addaudithook(_hook)
    runpy.run_path(sys.argv[1], run_name="__main__")


if __name__ == "__main__":
    main()
