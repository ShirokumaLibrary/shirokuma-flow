#!/usr/bin/env bash
# CLI install（tarball 配布）。
#
# SHIROKUMA_CLI_BASE（cli/ を指す URL or ローカルパス）から manifest.json を読み、
# core CLI（@shirokuma-library/flow）の tarball を取得して wrapper dir に npm install し、
# ~/.local/bin に bin を symlink する。Next.js 拡張（@shirokuma-library/nextjs）の tarball は
# 利用者が自分の TS プロジェクトに足す（opt-in）ため、取得先を案内するに留める。
#
# 前提: node + npm + curl（URL の場合）。自前パッケージは tarball 同梱で npm 非経由だが、
# 第三者依存（commander/yaml）は npm install 時に npm registry から取得する（ネット接続が要る）。
#
# 配信元: ShirokumaLibrary/shirokuma-flow の cli/。既定は gh 認証で取得する経路（contents API）。
#   既定（gh 認証）:   SHIROKUMA_CLI_BASE=gh:ShirokumaLibrary/shirokuma-flow/cli（gh 認証が要る）
#   public raw URL:    SHIROKUMA_CLI_BASE=https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/cli install-cli.sh
set -euo pipefail

# 既定は canonical 配信元。env で上書き可（ローカル/公開 URL）。
BASE="${SHIROKUMA_CLI_BASE:-gh:ShirokumaLibrary/shirokuma-flow/cli}"
BASE="${BASE%/}"  # 末尾スラッシュを正規化（gh: の subpath が `cli//file` にならないように）
# env で上書きできる 2 つも `--` 始まりを弾く（`STAGE` / `WORK` と同じ扱いにそろえる）。
WRAPPER_DIR="${SHIROKUMA_WRAPPER_DIR:-$HOME/.local/share/shirokuma-flow}"
BIN_DIR="${SHIROKUMA_BIN_DIR:-$HOME/.local/bin}"
for d in "${WRAPPER_DIR}" "${BIN_DIR}"; do
  case "$d" in
    ""|-*) echo "install 先の指定が不正（空、または先頭が -）: 環境変数を確認" >&2; exit 2 ;;
    /*) ;;
    # **相対値を弾く**。相対のままだと `ln -sf` が `BIN_DIR` から見て解決
    # できない相対 symlink を張り、**壊れたリンクを無言で残す**（`ls` では存在して見える）。
    *) echo "install 先は絶対パスで指定すること（相対値: 環境変数を確認）" >&2; exit 2 ;;
  esac
done
CORE_PKG="@shirokuma-library/flow"

# **絶対パスに正規化する**。`mktemp -d` は `TMPDIR` をそのまま接頭辞にするので、
# `TMPDIR` が相対なら STAGE も相対になり、`--` で始まる値になりうる（実測: `TMPDIR='--eval=X' mktemp -d`
# → `--eval=X/tmp.XXXX`）。以降 STAGE は `npm install` / `cp` / `ln` の引数にもなるため、
# 起動ごとに `--` を足すのではなく**値の側**で閉じる。
# `CDPATH` が非空だと `cd` が解決先を印字し、STAGE が 2 行値になる。
# `mktemp` が失敗した回に空値のまま進まないよう、直後に実在を確かめる。
STAGE="$(CDPATH= cd -- "$(mktemp -d)" && pwd)"
[ -n "${STAGE}" ] && [ -d "${STAGE}" ] || { echo "一時ディレクトリを作れない（TMPDIR を確認）" >&2; exit 1; }
trap 'rm -rf "${STAGE}"' EXIT

# BASE のスキーム:
#   gh:OWNER/REPO/SUBPATH  … private repo を gh 認証で contents API 取得（raw）
#   http(s)://…/cli        … 公開 URL を curl 取得
#   /path or ./path        … ローカルパスを cp
# gh: は SHIROKUMA_CLI_GH_REF（既定: repo の既定ブランチ）で ref を指定できる。
GH_REF="${SHIROKUMA_CLI_GH_REF:-}"
is_gh() { case "$1" in gh:*) return 0 ;; *) return 1 ;; esac; }
is_url() { case "$1" in http://*|https://*) return 0 ;; *) return 1 ;; esac; }
fetch() { # fetch <src-rel> <dest>
  local rel="$1" dest="$2"
  if is_gh "${BASE}"; then
    # gh:OWNER/REPO/SUBPATH を分解し、contents API で <SUBPATH>/<rel> を raw 取得。
    local spec owner_repo subpath full api
    spec="${BASE#gh:}"
    owner_repo="$(printf '%s' "${spec}" | cut -d/ -f1-2)"
    subpath="$(printf '%s' "${spec}" | cut -d/ -f3-)"
    full="${subpath:+${subpath}/}${rel}"
    api="repos/${owner_repo}/contents/${full}"
    [ -n "${GH_REF}" ] && api="${api}?ref=${GH_REF}"
    # 配信元が private な構成では、gh の**有効アカウント**が配信元へのアクセス権を持たないと
    # ここが `Repository not found` で落ちる（credential helper は有効アカウントで取りに行く）。
    # 素の gh エラーは「repo が無い」と読めるので、切り分けの材料だけを添える。
    #
    # **切り替えは案内しない**: `gh auth switch` は有効アカウントを**このスクリプトの外まで**変える
    # 操作で、同じ環境の他の作業にも影響する。どのアカウントで作業するかは人の判断なので、
    # ここは読み取り専用の確認（`gh auth status`）までに留め、処分は人に残す。
    if ! gh api "${api}" -H "Accept: application/vnd.github.raw" > "${dest}"; then
      {
        echo "配信元からの取得に失敗: ${api}"
        echo "配信元が private の場合、gh の有効アカウントにアクセス権が要る。"
        echo "  gh auth status   # 有効アカウントを確認（読み取りのみ）"
        echo "有効アカウントにアクセス権が無い場合、どう解消するか（別アカウントを使う／権限を足す）は人が決める。"
        echo "アクセス権があるのに失敗する場合は、配信元（${owner_repo}）と ref の指定を確認する。"
      } >&2
      return 1
    fi
  elif is_url "${BASE}"; then
    curl -fsSL "${BASE%/}/${rel}" -o "${dest}"
  else
    cp -- "${BASE%/}/${rel}" "${dest}"
  fi
}

# manifest の tarball 名は「ファイル名 1 個」でなければならない。
# manifest はスクリプトより低い信頼度の出所から来ないのが既定経路だが、`SHIROKUMA_CLI_BASE` を
# 別のホストへ向ければ他人の manifest がここへ入る。`p.tarball` は**ローカルの書き込み先**として
# 使われる（`fetch "${CORE_TARBALL}" "${STAGE}/${CORE_TARBALL}"`）ので、`../` を含む値は staging の外を指しうる。
# 値域で弾いて、安全性を「既定の BASE が自前 repo である」という運用前提から外す。
assert_tarball_name() {
  # ① 最初に allowlist を当てる。**この検査より前に `$1` を出力しない**——
  # 以降の分岐は失敗時の案内ブロック（「人が次に打つべきコマンド」を並べた出力）へ値を載せるので、
  # 未検査の値をそこへ通すと CR / LF で**行を上書きして偽の助言行を差し込める**し、U+202E 等の
  # bidi override で表示を反転できる。denylist（`*[[:cntrl:]]*`）を 2 番目の分岐として
  # 足す形では、1 番目の分岐に当たる値（`../x` + LF + …）が検査を通らず生で出る。
  # denylist では列挙漏れが残るので、**通す文字の側**を持つ
  # （tarball 名は配信側が
  # `${name#@} | tr '/' '-' + .tgz` で作るので、この文字集合で足りる）。
  # ここは値を表示しない（表示すると弾いた側の行が同じ問題を持つ）。
  # `-` 始まりも弾く。`-` は許容文字集合に含まれるので、この分岐が無いと `-rf.tgz` の形が
  # 3 段すべてを通る。値が argv の先頭語にならないことを、呼び出し側の書き方ではなく値の側で保証する。
  # 正規の tarball 名は `-` で始まらない。
  case "$1" in
    ""|-*|*[!A-Za-z0-9._-]*)
      echo "manifest の tarball が不正（空、先頭が - 、または許容文字 [A-Za-z0-9._-] の外を含む。値は表示しない）" >&2
      exit 1
      ;;
  esac
  # ② 以降の分岐は allowlist を通った値だけを見る（`/` や制御文字はここへ到達しない）ので、
  # 値を表示してよい。`*/*` は ① で到達不能だが、① を緩めたときの二枚目として残す。
  case "$1" in
    ""|*/*|*..*)
      echo "manifest の tarball が不正（ファイル名でない）: $1" >&2
      exit 1
      ;;
  esac
  case "$1" in
    *.tgz) ;;
    *)
      echo "manifest の tarball が不正（.tgz でない）: $1" >&2
      exit 1
      ;;
  esac
}

# tarball 名と同型: manifest の `version` は**パスには使わない**が、
# tarball 名と同じ出力面（`core: ...@${CORE_VERSION}` と完了行）へ生で載る。
# 行を上書きして偽の助言行を差し込める点は tarball 名と同じなので同じ形で弾く。パス要素にはならないので `+` まで許す（semver の build metadata）。
# 空は許す——`version` 欄が空文字の manifest で install を落とすのは、この検査の目的（出力面の
# 保護）を超える。
assert_version_string() {
  # `-` 始まりは tarball 名と同じ理由で弾く。semver に `-` 始まりは無い。
  # 空は上記のとおり許すので `-*` は空にマッチしない形で足す。
  case "$1" in
    -*|*[!A-Za-z0-9._+-]*)
      echo "manifest の version が不正（先頭が - 、または許容文字 [A-Za-z0-9._+-] の外を含む。値は表示しない）" >&2
      exit 1
      ;;
  esac
}

echo "==> manifest を取得: ${BASE%/}/manifest.json"
fetch "manifest.json" "${STAGE}/manifest.json"

# manifest を node でパースし、core の tarball ファイル名と version を得る。
CORE_TARBALL="$(node -e '
  const m = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const p = (m.packages||[]).find(x => x.name === process.argv[2]);
  if (!p) { console.error("manifest に " + process.argv[2] + " が無い"); process.exit(1); }
  process.stdout.write(p.tarball);
' -- "${STAGE}/manifest.json" "${CORE_PKG}")"
CORE_VERSION="$(node -e '
  const m = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const p = (m.packages||[]).find(x => x.name === process.argv[2]);
  process.stdout.write(p ? p.version : "");
' -- "${STAGE}/manifest.json" "${CORE_PKG}")"
assert_tarball_name "${CORE_TARBALL}"
assert_version_string "${CORE_VERSION}"
echo "      core: ${CORE_PKG}@${CORE_VERSION} (${CORE_TARBALL})"

echo "==> tarball を取得: ${CORE_TARBALL}"
fetch "${CORE_TARBALL}" "${STAGE}/${CORE_TARBALL}"

echo "==> wrapper dir に install: ${WRAPPER_DIR}"
mkdir -p -- "${WRAPPER_DIR}"
if [ ! -f "${WRAPPER_DIR}/package.json" ]; then
  echo '{"name":"shirokuma-flow-cli-wrapper","private":true}' > "${WRAPPER_DIR}/package.json"
fi
# 自前パッケージは tarball 同梱・第三者依存のみ npm registry から取得される。
# `WRAPPER_DIR` は env で上書きできる（`SHIROKUMA_WRAPPER_DIR`）。相対値＋`CDPATH` だと
# `cd` が別ツリーへ着地し、そこへ npm install してしまう。
(CDPATH= cd -- "${WRAPPER_DIR}" && npm install --no-audit --no-fund --save "${STAGE}/${CORE_TARBALL}")

echo "==> bin を symlink: ${BIN_DIR}/shirokuma-flow"
mkdir -p -- "${BIN_DIR}"
BIN_SRC="${WRAPPER_DIR}/node_modules/.bin/shirokuma-flow"
if [ ! -e "${BIN_SRC}" ]; then
  echo "bin が見つからない: ${BIN_SRC}" >&2
  exit 1
fi
ln -sf -- "${BIN_SRC}" "${BIN_DIR}/shirokuma-flow"

echo ""
echo "完了: shirokuma-flow を install しました（${CORE_PKG}@${CORE_VERSION}）。"
echo "  - PATH に ${BIN_DIR} を含めてください。"
echo "  - 確認: shirokuma-flow --help"

# Next.js 拡張は利用者のプロジェクト側で足す（cwd 探索で discover される）。
NEXTJS_TARBALL="$(node -e '
  const m = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const p = (m.packages||[]).find(x => x.name === process.argv[2]);
  process.stdout.write(p ? p.tarball : "");
' -- "${STAGE}/manifest.json" "@shirokuma-library/nextjs")"
if [ -n "${NEXTJS_TARBALL}" ]; then
  assert_tarball_name "${NEXTJS_TARBALL}"
  echo ""
  echo "Next.js 拡張（opt-in）: 自分の TS プロジェクトで足すと nextjs サブコマンドが使えます。"
  if is_gh "${BASE}"; then
    # private gh は npm が直接取得できないため、取得してからローカル install する手順を示す。
    echo "  （${NEXTJS_TARBALL} を gh で取得 → 自分のプロジェクトで npm install <取得した tgz>）"
  else
    echo "  npm install ${BASE%/}/${NEXTJS_TARBALL}"
  fi
fi

# TypeScript 言語拡張も利用者のプロジェクト側で足す（cwd 探索で discover）。
TS_TARBALL="$(node -e '
  const m = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const p = (m.packages||[]).find(x => x.name === process.argv[2]);
  process.stdout.write(p ? p.tarball : "");
' -- "${STAGE}/manifest.json" "@shirokuma-library/typescript")"
if [ -n "${TS_TARBALL}" ]; then
  assert_tarball_name "${TS_TARBALL}"
  echo ""
  echo "TypeScript 拡張（opt-in）: 自分の TS プロジェクトで足すと typescript（lint・doc-gen）サブコマンドが使えます。"
  if is_gh "${BASE}"; then
    echo "  （${TS_TARBALL} を gh で取得 → 自分のプロジェクトで npm install <取得した tgz>）"
  else
    echo "  npm install ${BASE%/}/${TS_TARBALL}"
  fi
fi
