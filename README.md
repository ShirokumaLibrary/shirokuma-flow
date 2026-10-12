# ShirokumaLibrary/shirokuma-flow（CLI tarball ＋ プラグイン配信）

shirokuma-flow の配信先。

この README は配置のたびに生成し直される。手で直した内容は次の配置で消える。

## CLI を導入する

配信物は `cli/` に揃っている: `cli/manifest.json` ＋ `cli/*.tgz` ＋ install スクリプト `cli/install-cli.sh`。
導入はこの repo だけで完結する（ほかの repo は要らない）。

```sh
# 0) 作業用の一時ディレクトリを作る（固定パスへ書かない＝取得と実行の間に差し替えられない）
#    絶対パスへ正規化する。`mktemp -d` は $TMPDIR をそのまま接頭辞にするので、相対値だと
#    以降の `bash` / `gh` の引数が `--` で始まりうる。
d="$(CDPATH= cd -- "$(mktemp -d)" && pwd)"; trap 'rm -rf -- "$d"' EXIT
[ -n "$d" ] && [ -d "$d" ] || { echo "一時ディレクトリを作れない（TMPDIR を確認）" >&2; exit 1; }

# 1) install スクリプトを取得する（gh 認証で contents API から raw 取得）
gh api repos/ShirokumaLibrary/shirokuma-flow/contents/cli/install-cli.sh -H "Accept: application/vnd.github.raw" > "$d/install-cli.sh"

# 2) この repo を配信元に指定して実行する
SHIROKUMA_CLI_BASE=gh:ShirokumaLibrary/shirokuma-flow/cli bash -- "$d/install-cli.sh"

# 3) 確認（`~/.local/bin` を PATH に通しておく）
shirokuma-flow --version
```

`SHIROKUMA_CLI_BASE=gh:ShirokumaLibrary/shirokuma-flow/cli` は**必ず付ける**。同梱した `install-cli.sh` は
内蔵する既定の配信元から取りに行き、その既定はこの repo と同じとは限らない。

## プラグイン

`claude plugin marketplace add ShirokumaLibrary/shirokuma-flow` で登録する（git の認証で取得する）。
