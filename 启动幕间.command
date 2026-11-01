#!/bin/zsh
# Finder resolves this symlink to the project, including paths with spaces.
PROJECT_ROOT="${0:A:h}"
PYTHON="$PROJECT_ROOT/backend/.venv/bin/python"
[[ -x "$PYTHON" ]] || PYTHON=/usr/bin/python3
"$PYTHON" "$PROJECT_ROOT/scripts/local_launcher.py" "$@"
RESULT=$?
if [[ $RESULT -ne 0 ]]; then
  print ""
  print "幕间未能启动。请查看上方原因与日志路径。"
  if [[ -t 0 ]]; then
    read -r "?按回车结束…"
  fi
fi
exit $RESULT
