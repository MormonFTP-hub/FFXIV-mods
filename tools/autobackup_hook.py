"""Claude Code Stop hook: keep the GitHub backup current after every turn.

Registered in ~/.claude/settings.json, so it runs whichever folder a session started in. In well under a
second it checks whether anything in this repo changed since the last backup (git status, or a .pmp/.exe
newer than the last run). If so it starts tools/backup.py in a hidden background process and returns, so
the turn never waits on the upload. Output goes to .git/autobackup.log, and a failed run shows up as a
message at the end of the next turn.

    python tools/autobackup_hook.py          # the hook: check, start a backup if needed
    python tools/autobackup_hook.py --run    # the background part (one at a time, via a lock file)
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GIT = ROOT / '.git'
STAMP = GIT / 'autobackup.stamp'  # mtime = start of the last good run
LOCK = GIT / 'autobackup.lock'
LOG = GIT / 'autobackup.log'
STATUS = GIT / 'autobackup.json'
APPS = ['PmpViewer/PMP Viewer.exe', 'Authenticator/Authenticator.exe', 'InstaViewer/Insta Viewer.exe']
STALE_LOCK = 3600
NO_WINDOW, NEW_GROUP, BREAKAWAY = 0x08000000, 0x00000200, 0x01000000


def changed():
    git = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True,
                         creationflags=NO_WINDOW)
    if git.returncode or git.stdout.strip():
        return True
    since = STAMP.stat().st_mtime if STAMP.exists() else 0
    built = [*ROOT.glob('*/out*/*.pmp'), *ROOT.glob('*/*.pmp'), *(ROOT / a for a in APPS)]
    return any(p.exists() and p.stat().st_mtime > since for p in built)


def report_failure():
    """Print the last run's failure once, as a message the user sees."""
    try:
        status = json.loads(STATUS.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return
    if status.get('ok') or status.get('reported'):
        return
    status['reported'] = True
    STATUS.write_text(json.dumps(status), encoding='utf-8')
    print(json.dumps({'systemMessage': f'GitHub backup failed: {status["message"]} (log: {LOG})'}))


def start_background():
    args = [sys.executable, str(Path(__file__).resolve()), '--run']
    common = dict(cwd=ROOT, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
    try:  # leave Claude Code's job object, so the upload outlives the hook
        subprocess.Popen(args, creationflags=NO_WINDOW | NEW_GROUP | BREAKAWAY, **common)
    except OSError:
        subprocess.Popen(args, creationflags=NO_WINDOW | NEW_GROUP, **common)


def take_lock():
    for _ in range(2):
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            if time.time() - LOCK.stat().st_mtime < STALE_LOCK:
                return False
            LOCK.unlink(missing_ok=True)
            continue
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    return False


def write_status(ok, message):
    STATUS.write_text(json.dumps({'ok': ok, 'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'message': message}),
                      encoding='utf-8')


def run_backups():
    if not take_lock():
        return
    try:
        if LOG.exists() and LOG.stat().st_size > 1_000_000:
            LOG.write_bytes(LOG.read_bytes()[-200_000:])
        for _ in range(3):  # again if something changed while the last run was uploading
            start = time.time()
            with open(LOG, 'a', encoding='utf-8') as log:
                log.write(f'\n== {time.strftime("%Y-%m-%d %H:%M:%S")}\n')
                log.flush()
                r = subprocess.run([sys.executable, str(ROOT / 'tools' / 'backup.py')], cwd=ROOT,
                                   stdout=log, stderr=subprocess.STDOUT, creationflags=NO_WINDOW)
            if r.returncode:
                tail = [line for line in LOG.read_text(encoding='utf-8', errors='replace').splitlines() if line.strip()]
                write_status(False, ' / '.join(tail[-3:])[:400])
                return
            STAMP.touch()
            os.utime(STAMP, (start, start))
            write_status(True, 'up to date')
            if not changed():
                return
    finally:
        LOCK.unlink(missing_ok=True)


def main():
    if '--run' in sys.argv:
        run_backups()
        return
    if not GIT.is_dir():
        return
    report_failure()
    running = LOCK.exists() and time.time() - LOCK.stat().st_mtime < STALE_LOCK
    if not running and changed():
        start_background()


if __name__ == '__main__':
    main()
