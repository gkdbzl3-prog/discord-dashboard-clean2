#!/usr/bin/env bash
# 데스크톱 위젯을 KDE 에 등록한다. 두 가지를 한다.
#   1. 앱 메뉴에 "외출 카운트다운" 항목을 만든다
#   2. 그 창을 항상 위에 두는 KWin 규칙을 넣는다
#
# 홈 디렉터리를 건드리므로 일부러 따로 떼어놨다. 되돌리려면
# `--uninstall` 을 붙여서 다시 돌리면 된다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER="$HERE/away-desktop"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ENTRY="$APPS/away-desktop.desktop"
RULE_ID="away-desktop-keep-above"
# 창 제목으로 잡는다. 크롬 앱 창의 제목은 페이지의 <title> 그대로다.
WINDOW_TITLE="외출 카운트다운"

kw() { kwriteconfig6 --file kwinrulesrc "$@"; }
# 배포판마다 이름이 갈린다. 있는 걸 쓴다.
kwin_reconfigure() {
  for q in qdbus6 qdbus /usr/lib/qt6/bin/qdbus; do
    if command -v "$q" >/dev/null 2>&1; then
      "$q" org.kde.KWin /KWin reconfigure >/dev/null 2>&1 && return 0
    fi
  done
  echo "KWin 을 다시 읽히지 못했어. 로그아웃했다 들어오면 적용된다." >&2
}
kr() { kreadconfig6 --file kwinrulesrc "$@"; }

rules_list() { kr --group General --key rules --default ""; }

remove_rule() {
  local list current
  current="$(rules_list)"
  list="$(printf '%s' "$current" | tr ',' '\n' | grep -vx "$RULE_ID" | paste -sd, -)"
  kw --group General --key rules "$list"
  kw --group General --key count "$(printf '%s' "$list" | tr ',' '\n' | grep -c . || true)"
  kw --group "$RULE_ID" --key Description --delete 2>/dev/null || true
  for key in above aboverule skiptaskbar skiptaskbarrule skipswitcher \
             skipswitcherrule skippager skippagerrule title titlematch; do
    kw --group "$RULE_ID" --key "$key" --delete 2>/dev/null || true
  done
}

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$ENTRY"
  remove_rule
  kwin_reconfigure
  echo "지웠어. 앱 메뉴 항목과 KWin 규칙 둘 다."
  exit 0
fi

mkdir -p "$APPS"
sed "s|__EXEC__|$LAUNCHER|" "$HERE/away-desktop.desktop" > "$ENTRY"
chmod +x "$ENTRY"

# 이미 있으면 지우고 다시 넣는다. 두 번 돌려도 중복되지 않게.
remove_rule

# 규칙 값: 1=Do Not Affect, 2=Apply, 3=Remember, 4=Force.
# 항상 위는 Force 라야 창이 스스로 내려가지 않는다.
# 매칭: 0=Unimportant, 1=Exact, 2=Substring, 3=Regex.
kw --group "$RULE_ID" --key Description "외출 카운트다운 항상 위"
kw --group "$RULE_ID" --key title "$WINDOW_TITLE"
kw --group "$RULE_ID" --key titlematch 1
kw --group "$RULE_ID" --key above true
kw --group "$RULE_ID" --key aboverule 4
kw --group "$RULE_ID" --key skiptaskbar true
kw --group "$RULE_ID" --key skiptaskbarrule 4
kw --group "$RULE_ID" --key skipswitcher true
kw --group "$RULE_ID" --key skipswitcherrule 4
kw --group "$RULE_ID" --key skippager true
kw --group "$RULE_ID" --key skippagerrule 4

existing="$(rules_list)"
if [ -n "$existing" ]; then
  kw --group General --key rules "$existing,$RULE_ID"
else
  kw --group General --key rules "$RULE_ID"
fi
kw --group General --key count "$(rules_list | tr ',' '\n' | grep -c .)"

kwin_reconfigure

echo "됐어."
echo "  앱 메뉴: 외출 카운트다운"
echo "  바로 띄우려면: $LAUNCHER"
