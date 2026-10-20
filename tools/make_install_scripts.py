"""Build install/Install Client-Ready.cmd and install/Uninstall Client-Ready.cmd from manifest.xml.

The install script is a plain Windows batch file: double-click to run. It writes manifest.xml to
%LOCALAPPDATA%\\ClientReady and registers it under HKCU\\...\\Office\\16.0\\WEF\\Developer, which makes
Office list the add-in under "Developer add-ins". Current user only: no admin rights, no downloads.
Run after changing manifest.xml:  python3 tools/make_install_scripts.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "install"
KEY = r"HKCU\Software\Microsoft\Office\16.0\WEF\Developer"
FOLDER = r"%LOCALAPPDATA%\ClientReady"


def cmd_escape(line):
    """Escape a line for `echo` in a batch file."""
    line = line.replace("^", "^^").replace("%", "%%")
    for ch in "<>&|":
        line = line.replace(ch, "^" + ch)
    return line


def manifest_lines():
    xml = (ROOT / "manifest.xml").read_text(encoding="utf-8")
    xml = re.sub(r"<!--.*?-->\s*", "", xml, flags=re.S)  # comments are not needed on the laptop
    lines = [l.rstrip() for l in xml.splitlines() if l.strip()]
    if any(ord(c) > 127 for l in lines for c in l):
        raise SystemExit("manifest.xml must be plain ASCII to be written by a batch file")
    return lines, re.search(r"<Id>([^<]+)</Id>", xml).group(1)


def main():
    lines, addin_id = manifest_lines()
    echo = [f'>"%F%" echo {cmd_escape(lines[0])}'] + [f'>>"%F%" echo {cmd_escape(l)}' for l in lines[1:]]
    install = [
        "@echo off",
        "rem Client-Ready (BDO formatting) - registers the PowerPoint add-in for the current Windows user.",
        "rem Writes only to your own user profile: no admin rights, no downloads, no security settings changed.",
        "rem Remove it again with \"Uninstall Client-Ready.cmd\".",
        "echo.",
        "echo Installing Client-Ready for PowerPoint (current user only)...",
        f'set "D={FOLDER}"',
        'set "F=%D%\\manifest.xml"',
        'if not exist "%D%" mkdir "%D%"',
        *echo,
        f'reg add "{KEY}" /v "{addin_id}" /t REG_SZ /d "%F%" /f >nul',
        "if errorlevel 1 (",
        "  echo.",
        "  echo Could not register the add-in. Your organisation may block this; nothing else was changed.",
        "  pause",
        "  exit /b 1",
        ")",
        "echo.",
        "echo Done. Now:",
        "echo   1. Close PowerPoint completely (all windows) and open it again.",
        "echo   2. Home ^> Add-ins: Client-Ready is listed under Developer add-ins.",
        "echo   3. If it is not there yet, restart the laptop once.",
        "echo.",
        "pause",
    ]
    uninstall = [
        "@echo off",
        "rem Client-Ready (BDO formatting) - removes the add-in registration for the current Windows user.",
        "echo Removing Client-Ready...",
        f'reg delete "{KEY}" /v "{addin_id}" /f >nul 2>&1',
        f'if exist "{FOLDER}" rmdir /s /q "{FOLDER}"',
        "echo Done. Close and reopen PowerPoint.",
        "pause",
    ]
    OUT.mkdir(exist_ok=True)
    for name, body in (("Install Client-Ready.cmd", install), ("Uninstall Client-Ready.cmd", uninstall)):
        (OUT / name).write_bytes(("\r\n".join(body) + "\r\n").encode("ascii"))
        print("Wrote", OUT / name)


if __name__ == "__main__":
    main()
