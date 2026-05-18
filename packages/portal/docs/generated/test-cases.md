# テストケース一覧

生成日時: 2026/5/1 17:44:39

## サマリー

| 項目 | 件数 |
|------|------|
| 総テストファイル数 | 39 |
| 総テストケース数 | 737 |
| Jest ファイル数 | 39 |
| Jest テスト数 | 737 |
| Playwright ファイル数 | 0 |
| Playwright テスト数 | 0 |

## Jest テスト

### tests/cli.test.ts

#### shirokuma-portal CLI

- [ ] --help でヘルプが表示される (L10)
- [ ] --version でバージョンが表示される (L15)
- [ ] generate --project . が終了コード 0 で完了する (L19)

### tests/parsers/test-categorization.test.ts

#### test-categorization > inferCategoryFromTestName

- [ ] 認証関連キーワードからauthカテゴリを検出する (L23)
  - EN: should detect auth-related tests
- [ ] 日本語の認証キーワードからauthカテゴリを検出する (L34)
  - EN: should detect Japanese auth keywords
- [ ] エラー関連キーワードからerror-handlingカテゴリを検出する (L44)
  - EN: should detect error-related tests
- [ ] 日本語のエラーキーワードからerror-handlingカテゴリを検出する (L53)
  - EN: should detect Japanese error keywords
- [ ] バリデーション関連キーワードからvalidationカテゴリを検出する (L61)
  - EN: should detect validation-related tests
- [ ] エッジケース関連キーワードからedge-caseカテゴリを検出する (L72)
  - EN: should detect edge-case tests
- [ ] CRUD操作キーワードからhappy-pathカテゴリを検出する (L82)
  - EN: should detect happy-path tests
- [ ] 日本語のCRUD操作キーワードからhappy-pathカテゴリを検出する (L93)
  - EN: should detect Japanese happy-path keywords
- [ ] 認識できないパターンに対してotherカテゴリを返す (L104)
  - EN: should return 

#### test-categorization > computeCategoryStats

- [ ] テストケースからカテゴリ別統計を算出する (L114)
  - EN: should compute category statistics
- [ ] 空配列に対して全カテゴリのカウントをゼロで返す (L129)
  - EN: should return zero stats for empty array
- [ ] 明示的に指定されたカテゴリが推論より優先される (L143)
  - EN: should use explicit category over inferred

#### test-categorization > inferModuleFromPath

- [ ] actionsパスからactionモジュールを推論する (L157)
  - EN: should infer action module from actions path
- [ ] componentsパスからcomponentモジュールを推論する (L167)
  - EN: should infer component module from components path
- [ ] Playwrightテストからscreenモジュールを推論する (L177)
  - EN: should infer screen module for playwright tests
- [ ] e2eディレクトリ配下のJestテストもscreen型と判定する (L187)
  - EN: should detect e2e path for jest framework too
- [ ] 認識できないパスに対してunknownモジュールを返す (L195)
  - EN: should return unknown for unrecognized paths
- [ ] テストファイルの拡張子をモジュール名から除去する (L205)
  - EN: should strip test file extensions from name

#### test-categorization > getTestCategory

- [ ] モジュール型をテストカテゴリ名にマッピングする (L215)
  - EN: should map module types to categories

#### test-categorization > createSummary

- [ ] ファイル統計とテストケースからサマリーを正しく作成する (L227)
  - EN: should create correct summary
- [ ] 空の入力に対してゼロ値のサマリーを返す (L254)
  - EN: should handle empty inputs

### tests/parsers/test-annotations.test.ts

#### test-annotations > countBraces

- [ ] 単一の開き波括弧を正しくカウントする (L23)
  - EN: should count single opening brace
- [ ] 対になった波括弧のバランスを正しく計算する (L30)
  - EN: should count balanced braces
- [ ] ネストされた波括弧の深さを正しくカウントする (L37)
  - EN: should count nested braces
- [ ] 文字列リテラル内の波括弧を無視する (L45)
  - EN: should ignore braces inside strings
- [ ] 空行に対してゼロを返す (L54)
  - EN: should return 0 for empty line
- [ ] エスケープされた文字を含む文字列を正しく処理する (L61)
  - EN: should handle escaped characters

#### test-annotations > parseTestCategory

- [ ] 正常系カテゴリのバリエーションを正しく解析する (L70)
  - EN: should parse happy-path variants
- [ ] 認証カテゴリのバリエーションを正しく解析する (L80)
  - EN: should parse auth variants
- [ ] エラーハンドリングカテゴリのバリエーションを正しく解析する (L91)
  - EN: should parse error-handling variants
- [ ] バリデーションカテゴリのバリエーションを正しく解析する (L100)
  - EN: should parse validation variants
- [ ] エッジケースカテゴリのバリエーションを正しく解析する (L109)
  - EN: should parse edge-case variants
- [ ] 未知のカテゴリに対してotherを返す (L120)
  - EN: should return 
- [ ] カテゴリの大文字小文字を区別しない (L128)
  - EN: should be case insensitive

#### test-annotations > extractTestDocComment

- [ ] JSDocから@testdocタグの値を抽出する (L138)
  - EN: should extract @testdoc from JSDoc
- [ ] 複数のタグ（purpose, precondition, expected）を同時に抽出する (L153)
  - EN: should extract multiple tags
- [ ] BDDアノテーション（given/when/then/and）を抽出する (L174)
  - EN: should extract BDD annotations
- [ ] @testCategoryタグからカテゴリを抽出する (L196)
  - EN: should extract @testCategory
- [ ] @appタグからアプリ名を抽出する (L211)
  - EN: should extract @app tag
- [ ] @skip-reasonタグからスキップ理由を抽出する (L227)
  - EN: should extract @skip-reason tag
- [ ] JSDocが存在しない場合にnullを返す (L242)
  - EN: should return null when no JSDoc present
- [ ] 関連タグのないJSDocに対してnullを返す (L254)
  - EN: should return null for JSDoc without relevant tags

#### test-annotations > extractFileDocComment

- [ ] ファイルヘッダーから@testFileDocと関連タグを抽出する (L270)
  - EN: should extract @testFileDoc from file header
- [ ] ファイルヘッダーから@appタグを抽出する (L288)
  - EN: should extract @app from file header
- [ ] ファイルドキュメントがない場合にnullを返す (L301)
  - EN: should return null when no file doc present
- [ ] testFileDocタグのないJSDocに対してnullを返す (L311)
  - EN: should return null for JSDoc without testFileDoc tags

#### test-annotations > extractDescribeDocComment

- [ ] describeブロックから@testGroupDocと関連タグを抽出する (L325)
  - EN: should extract @testGroupDoc from describe
- [ ] @priorityタグから優先度を抽出する (L342)
  - EN: should extract @priority
- [ ] ドキュメントがない場合にnullを返す (L358)
  - EN: should return null when no doc present

#### test-annotations > extractTestCases

- [ ] 単純なテストケースをdescribeとit名で抽出する (L372)
  - EN: should extract simple test cases
- [ ] ネストされたdescribeブロックのパスを結合して抽出する (L395)
  - EN: should handle nested describes
- [ ] テストケースからJSDocの@testdocアノテーションを抽出する (L411)
  - EN: should extract JSDoc annotations from test cases
- [ ] スキップされたテストを検出してフラグを設定する (L427)
  - EN: should detect skipped tests
- [ ] テストケースの行番号を正確に記録する (L462)
  - EN: should capture correct line numbers
- [ ] 最初のテストケースの行番号を検証する */ (L465)
  - EN: first
- [ ] 2番目のテストケースの行番号を検証する */ (L467)
  - EN: second

#### test-annotations > extractTestCases > UserService

- [ ] ユーザーを作成してDBに保存する */ (L376)
  - EN: should create user
- [ ] ユーザーをDBから削除して結果を返す */ (L381)
  - EN: should delete user

#### test-annotations > extractTestCases > outer > inner

- [ ] ネストされた内部テストの動作を検証する */ (L400)
  - EN: test

#### test-annotations > extractTestCases > test

- [ ] ユーザーを新規作成する (L417)
  - EN: should create user
- [ ] スキップ対象のテストケースを検証する (L434)
  - EN: skipped test
- [ ] 通常実行のテストケースを検証する */ (L436)
  - EN: normal test

#### test-annotations > extractTestCases > E2E test

- [ ] ページの読み込みが正常に完了することを検証する */ (L451)
  - EN: should load page

#### test-annotations

- [ ] describeブロック外のテストをファイル名ベースで分類する (L477)
  - EN: should handle tests outside describe blocks

### tests/parsers/screenshot-annotations.test.ts

#### parseScreenshotAnnotations

- [ ] 基本的な@screenshotアノテーションを解析できる (L23)
  - EN: should parse basic @screenshot annotation
  - 目的: 最小限のアノテーション解析
- [ ] @screenshotがないページはnullを返す (L42)
  - EN: should return null when @screenshot is not present
  - 目的: アノテーションなしのページを無視
- [ ] @screenshot-viewportを解析できる (L58)
  - EN: should parse @screenshot-viewport annotation
  - 目的: カスタムビューポートサイズの解析
- [ ] 無効な@screenshot-viewportフォーマットは無視する (L77)
  - EN: should ignore invalid viewport format
  - 目的: 不正なビューポート指定のハンドリング
- [ ] @screenshot-authを解析できる (L96)
  - EN: should parse @screenshot-auth annotation
  - 目的: 認証要件の解析
- [ ] @screenshot-waitForを解析できる (L135)
  - EN: should parse @screenshot-waitFor annotation
  - 目的: 待機条件の解析
- [ ] @screenshot-delayを解析できる (L152)
  - EN: should parse @screenshot-delay annotation
  - 目的: 遅延時間の解析
- [ ] 無効な@screenshot-delayは無視する (L169)
  - EN: should ignore invalid delay format
  - 目的: 不正な遅延指定のハンドリング
- [ ] 全てのアノテーションを組み合わせて解析できる (L186)
  - EN: should parse all annotations together
  - 目的: 複合アノテーションの解析
- [ ] @routeアノテーションを解析できる (L222)
  - EN: should extract @route annotation
  - 目的: 明示的なルート指定の解析
- [ ] @screenがない場合はファイル名からスクリーン名を推論する (L239)
  - EN: should infer screen name from file path if @screen is missing
  - 目的: スクリーン名のフォールバック
- [ ] 複数のJSDocブロックがある場合、@screenshotを含むものを検出する (L259)
  - EN: should find @screenshot in multiple JSDoc blocks
  - 目的: 複数コメントブロックの処理
- [ ] 説明文を正しく抽出できる (L282)
  - EN: should extract description correctly
  - 目的: JSDocの説明部分の抽出

#### scanFilesForScreenshots

- [ ] 複数のファイル内容からスクリーンショット対象を収集できる (L303)
  - EN: should collect screenshots from multiple files
  - 目的: バッチ処理のテスト
- [ ] 空の配列を処理できる (L349)
  - EN: should handle empty file list
  - 目的: 空入力のハンドリング

### tests/parsers/feature-map-utils.test.ts

#### feature-map-utils > extractTags

- [ ] JSDocブロックから基本的なタグを抽出する (L21)
  - EN: should extract basic tags
- [ ] 値なしのマーカータグ（@serverAction）を空文字列で処理する (L37)
  - EN: should handle marker tags like @serverAction
- [ ] タグ値の前後の空白をトリムする (L51)
  - EN: should trim tag values
- [ ] カンマ区切りの値を単一文字列として保持する (L65)
  - EN: should preserve comma-separated values as single string
- [ ] タグのないJSDocに対して空オブジェクトを返す (L79)
  - EN: should return empty object for JSDoc without tags
- [ ] 閉じタグ直前のインラインタグを抽出する (L92)
  - EN: should extract tags before closing */

#### feature-map-utils > extractDescription

- [ ] 単一行の説明文を抽出する (L104)
  - EN: should extract single-line description
- [ ] 複数行の説明文を結合して抽出する (L116)
  - EN: should extract multi-line description
- [ ] タグのみで説明文がないJSDocに対してundefinedを返す (L130)
  - EN: should return undefined when no description exists
- [ ] 日本語の説明文を正しく抽出する (L142)
  - EN: should extract Japanese description
- [ ] 説明文の相対インデントを保持する (L154)
  - EN: should preserve content after JSDoc marker

#### feature-map-utils > parseCommaSeparatedList

- [ ] カンマ区切りの値を配列に分割する (L170)
  - EN: should parse comma-separated values
- [ ] undefined入力に対して空配列を返す (L178)
  - EN: should return empty array for undefined
- [ ] 空文字列に対して空配列を返す (L186)
  - EN: should return empty array for empty string
- [ ] 値の前後の空白をトリムして返す (L194)
  - EN: should trim whitespace from values
- [ ] カンマなしの単一値を1要素の配列として返す (L202)
  - EN: should handle single value
- [ ] 末尾カンマや連続カンマによる空エントリを除外する (L210)
  - EN: should filter out empty entries

#### feature-map-utils > extractModuleName

- [ ] actionsディレクトリからモジュール名を抽出する (L220)
  - EN: should extract module name from actions path
- [ ] componentsパスからサブディレクトリ名を抽出する (L228)
  - EN: should extract module name from components path
- [ ] ルートグループの括弧を除去してグループ名を抽出する (L236)
  - EN: should extract route group name without parentheses
- [ ] 動的ルートセグメントをスキップして次のディレクトリを使用する (L244)
  - EN: should skip dynamic route segments
- [ ] パッケージパスから除外対象外の最初のディレクトリを抽出する (L252)
  - EN: should extract from package path
- [ ] 有効なディレクトリがない場合にファイル名にフォールバックする (L261)
  - EN: should fallback to filename when no meaningful directory
- [ ] lib, app, srcなどの共通ディレクトリ名をスキップする (L269)
  - EN: should skip excluded directories like lib, app, src
- [ ] バックスラッシュ区切りのWindowsパスを正しく処理する (L277)
  - EN: should handle backslash paths

### tests/parsers/feature-map-type-extraction.test.ts

#### feature-map-type-extraction > extractBracedBlock

- [ ] 単純な波括弧ブロックを抽出する (L24)
  - EN: should extract a simple braced block
- [ ] ネストされた波括弧を正しく処理する (L33)
  - EN: should handle nested braces
- [ ] ダブルクォート・シングルクォート・バッククォート内の波括弧を無視する (L42)
  - EN: should ignore braces inside strings
- [ ] テンプレートリテラル内の波括弧を無視する (L51)
  - EN: should ignore braces inside template literals
- [ ] 行コメント内の波括弧を無視する (L60)
  - EN: should ignore braces inside line comments
- [ ] ブロックコメント内の波括弧を無視する (L69)
  - EN: should ignore braces inside block comments
- [ ] 開始位置が波括弧でない場合にnullを返す (L78)
  - EN: should return null if start is not a brace
- [ ] 対応のない波括弧に対してnullを返す (L87)
  - EN: should return null for unmatched braces
- [ ] 指定されたインデックス位置からブロックを抽出する (L96)
  - EN: should extract block starting from given index

#### feature-map-type-extraction > extractExportedTypes

- [ ] exportされたインターフェースを抽出する (L107)
  - EN: should extract exported interfaces
- [ ] exportされたオブジェクト型を抽出する (L126)
  - EN: should extract exported object types
- [ ] exportされたユニオン型を抽出する (L144)
  - EN: should extract exported union types
- [ ] exportされたenumを値付きで抽出する (L159)
  - EN: should extract exported enums
- [ ] 型定義に付与された複数行JSDocの説明文を抽出する (L178)
  - EN: should extract JSDoc description for types
- [ ] 1つのファイルから複数の型定義を抽出する (L196)
  - EN: should extract multiple types from single file
- [ ] exportされていない型定義を除外する (L221)
  - EN: should not extract non-exported types
- [ ] ネストされた型を含むインターフェースを処理する (L240)
  - EN: should handle interfaces with nested types

#### feature-map-type-extraction > extractPrecedingJSDoc

- [ ] 宣言の直前にあるJSDocを抽出する (L263)
  - EN: should extract JSDoc immediately before declaration
- [ ] 宣言前にJSDocがない場合にnullを返す (L278)
  - EN: should return null jsdoc when none present
- [ ] JSDocと宣言の間に空白行がある場合も抽出する (L289)
  - EN: should handle whitespace between JSDoc and declaration
- [ ] JSDocと宣言の間にコードがある場合は抽出しない (L302)
  - EN: should not extract JSDoc if code exists between

#### feature-map-type-extraction > extractInterfaceFields

- [ ] 基本的なフィールドを名前と型で抽出する (L317)
  - EN: should extract simple fields
- [ ] オプショナルフィールドを正しく処理する (L332)
  - EN: should handle optional fields
- [ ] インラインJSDocコメントをフィールド説明として抽出する (L347)
  - EN: should extract inline JSDoc as description
- [ ] 行コメントをフィールド説明として抽出する (L364)
  - EN: should extract line comments as description
- [ ] 空のボディに対して空配列を返す (L378)
  - EN: should return empty array for empty body

#### feature-map-type-extraction > extractEnumValues

- [ ] シンプルなenum値を抽出する (L388)
  - EN: should extract simple enum values
- [ ] 初期化子を無視してenum名のみ抽出する (L397)
  - EN: should extract enum names ignoring initializers
- [ ] 数値enum値を名前で抽出する (L410)
  - EN: should extract numeric enum values

#### feature-map-type-extraction > extractExportedUtilities

- [ ] exportされた定数を抽出する (L425)
  - EN: should extract exported constants
- [ ] アロー関数のexportを除外する (L441)
  - EN: should exclude arrow function exports
- [ ] @serverActionのないexport関数をJSDoc付きで抽出する (L458)
  - EN: should extract exported functions without @serverAction
- [ ] @serverActionタグ付き関数を除外する (L478)
  - EN: should exclude functions with @serverAction tag
- [ ] 型アノテーション付き定数の動作を確認する (L500)
  - EN: should extract type annotation from constants

#### feature-map-type-extraction > parseParams

- [ ] 型付きパラメータを名前と型に分解する (L519)
  - EN: should parse typed parameters
- [ ] オプショナルパラメータを正しく処理する (L530)
  - EN: should handle optional parameters
- [ ] パラメータ文字列が空の場合に空配列を返す (L540)
  - EN: should return empty array for empty string
- [ ] 空白のみの文字列に対して空配列を返す (L548)
  - EN: should return empty array for whitespace-only string
- [ ] 型アノテーションのないパラメータをunknownとして扱う (L556)
  - EN: should mark untyped parameters as unknown

### tests/parsers/feature-map-tags.test.ts

#### feature-map-tags > findCodeStartIndex

- [ ] import 文の位置をコード開始インデックスとして返す (L98)
  - EN: should return index of first import statement
- [ ] import がない場合は export 文の位置を返す (L107)
  - EN: should return index of export when no import
- [ ] import も export もない場合は宣言の位置を返す (L116)
  - EN: should return index of declaration when no import/export
- [ ] コードがない場合は 0 を返す (L125)
  - EN: should return 0 when no code found
- [ ] コメント前の空白を含むファイルを正しく処理する (L134)
  - EN: should handle files with leading whitespace

#### feature-map-tags > extractFileMetadata

- [ ] ヘッダー JSDoc から feature タグを抽出する (L145)
  - EN: should extract feature tag from header JSDoc
- [ ] ヘッダー JSDoc がない場合に空のメタデータを返す (L155)
  - EN: should return empty metadata when no header JSDoc
- [ ] @module タグを抽出する (L164)
  - EN: should extract module tag

#### feature-map-tags > extractItemName

- [ ] export function からアイテム名を抽出する (L176)
  - EN: should extract name from export function
- [ ] export async function からアイテム名を抽出する (L183)
  - EN: should extract name from export async function
- [ ] export default function からアイテム名を抽出する (L190)
  - EN: should extract name from export default function
- [ ] export const からアイテム名を抽出する (L197)
  - EN: should extract name from export const
- [ ] 通常の function からアイテム名を抽出する (L204)
  - EN: should extract name from regular function
- [ ] const からアイテム名を抽出する (L211)
  - EN: should extract name from const assignment
- [ ] パターンにマッチしない場合は undefined を返す (L218)
  - EN: should return undefined for no match

#### feature-map-tags > parseJSDocBlock

- [ ] @screen タグから screen アイテムを生成する (L227)
  - EN: should create screen item from @screen tag
- [ ] @component タグから component アイテムを生成する (L241)
  - EN: should create component item from @component tag
- [ ] @serverAction タグから action アイテムを生成する (L253)
  - EN: should create action item from @serverAction tag
- [ ] @serverAction で usedInScreen タグありでもファイルメタデータがフォールバックされる (L268)
  - EN: should use file metadata usedInScreens for action with usedInScreen tag
- [ ] @serverAction で関数レベルの usedInScreen がない場合にファイルメタデータをフォールバック使用する (L284)
  - EN: should fallback to file metadata usedInScreens when function-level is empty
- [ ] @module タグから module アイテムを生成する (L296)
  - EN: should create module item from @module tag
- [ ] @dbTable タグから table アイテムを生成する (L309)
  - EN: should create table item from @dbTable tag
- [ ] タイプが不明な場合は null を返す (L322)
  - EN: should return null when type is unknown
- [ ] ファイルメタデータの feature をアイテムに継承する (L331)
  - EN: should inherit feature from file metadata
- [ ] アイテムレベルの feature がファイルメタデータより優先される (L342)
  - EN: should prefer item-level feature over file metadata

#### feature-map-tags > parseFeatureMapTags

- [ ] ファイルからアイテムのみを返す（メタデータなし） (L355)
  - EN: should return only items without metadata

#### feature-map-tags > parseFeatureMapTagsWithMetadata

- [ ] ヘッダー JSDoc の @screen からアイテムを生成する (L377)
  - EN: should create item from header @screen tag
- [ ] コード内の JSDoc ブロックからアイテムを抽出する (L394)
  - EN: should extract items from inline JSDoc blocks
- [ ] ファイルメタデータの feature をインラインアイテムに継承する (L418)
  - EN: should inherit file metadata feature to inline items
- [ ] メタデータに types と utilities を含む (L438)
  - EN: should include types and utilities in result

### tests/parsers/drizzle-schema.test.ts

#### drizzle-schema > parseDrizzleSchema

- [ ] 基本的な pgTable 定義からテーブル名と変数名を抽出する (L20)
  - EN: should extract basic table definition
- [ ] カラムの型、制約（primaryKey, notNull, unique）を正しく抽出する (L37)
  - EN: should extract column types and constraints
- [ ] JSDoc コメントがある場合にテーブルを正しく抽出する (L81)
  - EN: should extract table even with preceding JSDoc
- [ ] JSDoc からカラムの description を抽出する (L95)
  - EN: should extract column JSDoc description
- [ ] references() から外部キーを抽出する (L110)
  - EN: should extract foreign keys from references
- [ ] インデックス定義を抽出する (L136)
  - EN: should extract index definitions
- [ ] 複数テーブルを含むファイルから全テーブルを抽出する (L164)
  - EN: should extract multiple tables from a single file
- [ ] ...timestamps スプレッドから created_at/updated_at カラムを追加する (L186)
  - EN: should add timestamp columns from spread syntax
- [ ] Drizzle 型を SQL 型に正しくマッピングする (L208)
  - EN: should map Drizzle types to SQL types
- [ ] ファイル名からカテゴリを推論する (L231)
  - EN: should infer category from file name
- [ ] テーブル定義がないソースコードに対して空配列を返す (L246)
  - EN: should return empty array for source without table definitions
- [ ] defaultNow() を含むカラムのデフォルト値を抽出する (L258)
  - EN: should extract defaultNow() as default value
- [ ] camelCase の変数名を snake_case に変換して FK カラム名にする (L273)
  - EN: should convert camelCase reference columns to snake_case
- [ ] JSDoc が前方にあり間に他のコードがある場合にテーブルを抽出する (L292)
  - EN: should extract table with JSDoc separated by code
- [ ] インデックス定義が配列形式の場合も抽出する (L310)
  - EN: should extract indexes from array-style definition
- [ ] 複合インデックス（複数カラム）を正しく抽出する (L328)
  - EN: should extract composite index with multiple columns

#### drizzle-schema > toPortalDbSchema

- [ ] DrizzleSchemaResult を Portal 用 JSON に正しく変換する (L348)
  - EN: should convert DrizzleSchemaResult to portal format
- [ ] 外部キーがある場合に foreignKeys を含める (L398)
  - EN: should include foreignKeys when present
- [ ] インデックスがない場合は indexes を undefined にする (L426)
  - EN: should set indexes to undefined when empty

### tests/parsers/details-zod.test.ts

#### details-zod > parseZodSchema

- [ ] 基本的なZodオブジェクトスキーマを解析する (L15)
  - EN: should parse a basic Zod object schema
- [ ] optionalおよびnullableフィールドを必須でないと判定する (L41)
  - EN: should handle optional fields
- [ ] describe()メソッドの値をフィールド説明として抽出する (L61)
  - EN: should extract .describe() values
- [ ] UUIDフォーマットとバリデーションメッセージを抽出する (L77)
  - EN: should handle uuid format
- [ ] default()メソッドのデフォルト値を型ごとに抽出する (L94)
  - EN: should handle .default() values
- [ ] z.enum()の列挙値を配列として抽出する (L118)
  - EN: should handle z.enum()
- [ ] 数値型のmin/max制約を最小値・最大値として抽出する (L135)
  - EN: should handle min/max for numbers
- [ ] 文字列型のmin/max制約をminLength/maxLengthとして抽出する (L152)
  - EN: should handle min/max for strings (minLength/maxLength)
- [ ] 存在しないスキーマ名に対してnullを返す (L169)
  - EN: should return null for non-existent schema
- [ ] exportされたスキーマも正しく解析する (L177)
  - EN: should handle exported schemas
- [ ] URLフォーマットのバリデーションを検出する (L191)
  - EN: should handle url format

#### details-zod > mapZodTypeToJsonType

- [ ] 標準的なZod型をJSON型に正しくマッピングする (L209)
  - EN: should map standard Zod types
- [ ] 未知の型に対してunknownを返す (L222)
  - EN: should return 

### tests/parsers/details-jsdoc.test.ts

#### details-jsdoc > cleanJSDoc

- [ ] JSDocの区切り文字とアスタリスクを除去する (L23)
  - EN: should remove JSDoc delimiters and asterisks
- [ ] 単一行のJSDocコメントを正しく処理する (L38)
  - EN: should handle single-line JSDoc
- [ ] 複数行の行構造を維持して出力する (L46)
  - EN: should preserve line structure

#### details-jsdoc > formatCode

- [ ] HTMLエンティティを正しくエスケープする (L61)
  - EN: should escape HTML entities

#### details-jsdoc > simpleMarkdown

- [ ] 空文字列の入力に対して空文字列を返す (L74)
  - EN: should return empty string for empty input
- [ ] テキストを段落タグで囲んで出力する (L81)
  - EN: should wrap text in paragraphs
- [ ] コードブロックを言語付きのpreタグに変換する (L89)
  - EN: should handle code blocks
- [ ] インラインコードをcodeタグに変換する (L100)
  - EN: should handle inline code
- [ ] 二重改行で段落を分割して出力する (L108)
  - EN: should separate paragraphs by double newline
- [ ] インラインコード内のHTMLをエスケープしてXSSを防止する (L117)
  - EN: should escape HTML in inline code to prevent XSS
- [ ] 段落テキスト内のHTMLをエスケープしてXSSを防止する (L127)
  - EN: should escape HTML in paragraph text to prevent XSS
- [ ] インラインコードと段落テキストの両方でHTMLエスケープする (L136)
  - EN: should escape HTML in mixed inline code and paragraph text
- [ ] コードブロックのエスケープを維持しつつ段落テキストもエスケープする (L146)
  - EN: should preserve code block escaping while escaping paragraphs

#### details-jsdoc > parseJSDoc

- [ ] プレーンテキストから説明文を解析する (L159)
  - EN: should parse description from plain text
- [ ] @paramタグを名前・型・説明に分解して解析する (L167)
  - EN: should parse @param tags
- [ ] @returnsタグの戻り値説明を解析する (L177)
  - EN: should parse @returns tag
- [ ] @returnエイリアスタグも正しく解析する (L185)
  - EN: should parse @return tag (alias)
- [ ] @throwsタグを複数件解析する (L193)
  - EN: should parse @throws tags
- [ ] @exampleタグのコードブロックを解析する (L202)
  - EN: should parse @example tag
- [ ] カスタムタグ（serverAction, feature, dbTables）を解析する (L211)
  - EN: should parse custom tags
- [ ] 空文字列の入力に対して空の解析結果を返す (L221)
  - EN: should return empty result for empty input
- [ ] @descriptionタグから説明文を解析する (L231)
  - EN: should parse @description tag

#### details-jsdoc > parseJSDocForJson

- [ ] 基本的なケースでparseJSDocと同様に解析する (L241)
  - EN: should parse like parseJSDoc for basic cases
- [ ] @errorCodesなど複数行タグを値として解析する (L250)
  - EN: should handle multiline tags like @errorCodes
- [ ] @throwエイリアスも@throwsと同様に解析する (L262)
  - EN: should handle @throws with alias @throw

#### details-jsdoc > splitTypeSourceCode

- [ ] JSDocと型定義部分を分離して返す (L273)
  - EN: should split JSDoc and type definition
- [ ] JSDocがない場合はソース全体を定義部分として返す (L290)
  - EN: should return full source as definition when no JSDoc

### tests/generators/test-cases-styles.test.ts

#### fileToId

- [ ] ファイルパスの英数字以外をハイフンに置換する (L36)
  - EN: should replace non-alphanumeric characters with hyphens
- [ ] スラッシュやドットをハイフンに変換する (L43)
  - EN: should convert slashes and dots to hyphens
- [ ] 英数字のみのファイル名はそのまま返す (L50)
  - EN: should keep alphanumeric-only names unchanged

#### groupBy

- [ ] 配列をキー関数でグループ化して Map を返す (L63)
  - EN: should group array items by key function
- [ ] 空配列の場合は空の Map を返す (L77)
  - EN: should return empty Map for empty array
- [ ] 全要素が同一キーの場合は1グループにまとまる (L85)
  - EN: should put all items in one group when key is same
- [ ] グループ内の順序が挿入順を保持する (L94)
  - EN: should maintain insertion order within groups

#### categoryToSlug

- [ ] カテゴリ名を小文字のケバブケースに変換する (L110)
  - EN: should convert category to lowercase kebab-case

#### fileToSlug

- [ ] .test.ts 拡張子を除去してスラッグを生成する (L126)
  - EN: should remove .test.ts extension
- [ ] .test.tsx 拡張子を除去してスラッグを生成する (L133)
  - EN: should remove .test.tsx extension
- [ ] .spec.ts 拡張子を除去してスラッグを生成する (L140)
  - EN: should remove .spec.ts extension
- [ ] .spec.js 拡張子を除去してスラッグを生成する (L147)
  - EN: should remove .spec.js extension
- [ ] 特殊文字をハイフンに変換する (L154)
  - EN: should replace special characters with hyphens

#### getCategoryIcon

- [ ] Server Actions カテゴリで ⚡ アイコンを返す (L167)
  - EN: should return lightning icon for Server Actions
- [ ] Components カテゴリで 🧩 アイコンを返す (L174)
  - EN: should return puzzle icon for Components
- [ ] E2E カテゴリで 🎭 アイコンを返す (L181)
  - EN: should return theatre icon for E2E
- [ ] 未知のカテゴリでデフォルトの 📄 アイコンを返す (L188)
  - EN: should return document icon for unknown category

#### getCategoryColor

- [ ] 各カテゴリに正しい色クラスを返す (L201)
  - EN: should return correct color class for each category

#### getCategoryBadgeHtml

- [ ] count=0 の場合は空文字を返す (L217)
  - EN: should return empty string when count is 0
- [ ] happy-path カテゴリのバッジにアイコンとカウントを含む (L224)
  - EN: should include icon and count for happy-path badge
- [ ] error-handling カテゴリのバッジに赤色を使用する (L235)
  - EN: should use red color for error-handling badge
- [ ] バッジが test-category-badge クラスを持つ span タグを返す (L245)
  - EN: should return span with test-category-badge class

#### getGlobalNavElements

- [ ] depth=1 で ../ プレフィックス付きの CSS と JS パスを返す (L260)
  - EN: should return paths with ../ prefix at depth 1
- [ ] depth=2 で ../../ プレフィックス付きのパスを返す (L269)
  - EN: should return paths with ../../ prefix at depth 2
- [ ] depth=0 でプレフィックスなしのパスを返す (L278)
  - EN: should return paths without prefix at depth 0

#### getSidebarStyles

- [ ] サイドバー関連のCSSクラスを含む (L294)
  - EN: should include sidebar CSS classes
- [ ] サマリーカードのスタイルを含む (L306)
  - EN: should include summary card styles
- [ ] テストアイテムのスタイルを含む (L316)
  - EN: should include test item styles
- [ ] BDD アノテーションスタイルを含む (L326)
  - EN: should include BDD annotation styles
- [ ] [test-cases-styles/getSidebarStyles] レスポンシブメディアクエリを含む (L338)
  - EN: should include responsive media query

#### getSearchScript

- [ ] searchInput イベントリスナーを含む (L352)
  - EN: should include searchInput event listener
- [ ] ファイルセクションのフィルタリングロジックを含む (L361)
  - EN: should include file section filtering logic
- [ ] スムーズスクロール機能を含む (L370)
  - EN: should include smooth scroll functionality

#### getCategoryListStyles

- [ ] カテゴリグリッドとカードのスタイルを含む (L385)
  - EN: should include category grid and card styles
- [ ] カテゴリ色のボーダースタイルを含む (L395)
  - EN: should include category color border styles
- [ ] [test-cases-styles/getCategoryListStyles] レスポンシブメディアクエリを含む (L406)
  - EN: should include responsive media query

#### getFileListStyles

- [ ] ファイルリストとカードのスタイルを含む (L420)
  - EN: should include file list and card styles
- [ ] [test-cases-styles/getFileListStyles] パンくずナビゲーションのスタイルを含む (L430)
  - EN: should include breadcrumb styles

#### getTestDetailStyles

- [ ] テストグループとアイテムのスタイルを含む (L446)
  - EN: should include test group and item styles
- [ ] [test-cases-styles/getTestDetailStyles] パンくずナビゲーションのスタイルを含む (L457)
  - EN: should include breadcrumb styles
- [ ] テストカテゴリバッジのスタイルを含む (L465)
  - EN: should include test category badge styles

### tests/generators/test-cases-main.test.ts

#### generateMarkdown

- [ ] Markdown のタイトルとサマリーテーブルを生成する (L80)
  - EN: should generate title and summary table
- [ ] フレームワーク別にテストをグループ化する (L96)
  - EN: should group tests by framework
- [ ] 日本語説明（description）がある場合に表示する (L111)
  - EN: should display description when available
- [ ] BDD アノテーション付きテストケースに [BDD] バッジを表示する (L123)
  - EN: should show BDD badge for BDD-annotated tests
- [ ] ファイル別統計テーブルを含む (L139)
  - EN: should include file statistics table
- [ ] 生成日時が ja-JP ロケールで含まれる (L151)
  - EN: should include generation date in ja-JP locale
- [ ] purpose と expected がある場合にそれぞれの行を出力する (L162)
  - EN: should include purpose and expected when available

#### generateHtml

- [ ] [test-cases-main] 完全な HTML ドキュメントを生成する (L192)
  - EN: should generate a complete HTML document
- [ ] [test-cases-main] タイトルにプロジェクト名を含む (L205)
  - EN: should include project name in title
- [ ] サイドバーとメインコンテンツを含む (L216)
  - EN: should include sidebar and main content
- [ ] 検索入力フィールドを含む (L229)
  - EN: should include search input field
- [ ] カテゴリ別にテストをグループ化して表示する (L241)
  - EN: should group tests by category in content
- [ ] [test-cases-main] ポータルに戻るリンクを含む (L261)
  - EN: should include back to portal link

#### buildSummaryCard

- [ ] サマリーカードにファイル数とテスト数を表示する (L288)
  - EN: should display file count and test count
- [ ] Jest と Playwright のテスト数を個別に表示する (L301)
  - EN: should display Jest and Playwright test counts separately
- [ ] summary-card クラスを持つ div を返す (L314)
  - EN: should return div with summary-card class
- [ ] サマリーカードに生成日時のタイムスタンプを含む (L325)
  - EN: should include generation timestamp

### tests/generators/test-cases-hierarchy.test.ts

#### generateCategoryListPage

- [ ] [test-cases-hierarchy] 完全な HTML ドキュメントを生成する (L95)
  - EN: should generate a complete HTML document
- [ ] [test-cases-hierarchy] タイトルにプロジェクト名を含む (L108)
  - EN: should include project name in title
- [ ] テスト数とファイル数の統計を表示する (L119)
  - EN: should display test and file statistics
- [ ] カテゴリカードにリンクとアイコンを含む (L131)
  - EN: should include category cards with links and icons
- [ ] テストがないカテゴリのカードは生成しない (L148)
  - EN: should not generate cards for empty categories
- [ ] [test-cases-hierarchy] ポータルに戻るリンクを含む (L162)
  - EN: should include back to portal link
- [ ] カテゴリバッジにテストカテゴリ統計を表示する (L174)
  - EN: should display category badges with test category stats

#### generateHierarchicalPages

- [ ] カテゴリページと詳細ページの数を返す (L204)
  - EN: should return counts of generated category and detail pages
- [ ] ensureDir でカテゴリディレクトリを作成する (L216)
  - EN: should create category directories via ensureDir
- [ ] writeFile でカテゴリ HTML とテスト詳細 HTML を書き込む (L227)
  - EN: should write category HTML and test detail HTML files
- [ ] 複数カテゴリのテストがある場合にそれぞれのページを生成する (L245)
  - EN: should generate pages for multiple categories
- [ ] 書き込まれた HTML にパンくずナビゲーションを含む (L269)
  - EN: should include breadcrumb navigation in written HTML
- [ ] 書き込まれた HTML にグローバルナビ要素を含む (L287)
  - EN: should include global nav elements in written HTML
- [ ] テストケースが空のカテゴリのページは生成しない (L301)
  - EN: should not generate pages for empty categories

### tests/generators/portal-generator.test.ts

#### PortalGenerator

- [ ] テンプレートが存在しない場合にエラーをスローする (L199)
  - EN: should throw when templates directory does not exist
- [ ] 最小データ（全データ null）でホームページのみ生成する (L210)
  - EN: should generate only home page with minimal data
- [ ] search-index.json が既に存在する場合は再生成しない (L222)
  - EN: should not regenerate search index if it already exists
- [ ] search-index.json が存在しない場合は生成する (L235)
  - EN: should generate search index when it does not exist
- [ ] assets ディレクトリのファイルをコピーする (L250)
  - EN: should copy assets files to output
- [ ] verbose オプションでログが出力される (L259)
  - EN: should log when verbose is enabled
- [ ] overview データがある場合は概要ページを生成する (L277)
  - EN: should generate overview page when overview is available
- [ ] feature-map がある場合は機能マップページを生成する (L293)
  - EN: should generate feature-map page when featureMap is available
- [ ] DB スキーマデータがある場合は一覧/ER図/テーブル詳細ページを生成する (L318)
  - EN: should generate db-schema pages with diagram and table detail
- [ ] 複数 DB がある場合は DB 別ページも生成する (L341)
  - EN: should generate per-database pages when multiple databases exist
- [ ] テストケースデータがある場合はファイル別・詳細ページを生成する (L359)
  - EN: should generate test-cases pages with file and detail pages
- [ ] i18n データがある場合は一覧/名前空間別ページを生成する (L383)
  - EN: should generate i18n pages with namespace pages
- [ ] パッケージデータがある場合は一覧/詳細ページを生成する (L402)
  - EN: should generate packages pages with detail pages
- [ ] API ツールデータがある場合は API ツールページを生成する (L423)
  - EN: should generate api-tools page when apiTools is available
- [ ] アプリケーションがある場合はアプリ別ホームページを生成する (L437)
  - EN: should generate application home pages
- [ ] 出力先ディレクトリが存在しない場合は作成する (L458)
  - EN: should create output directories when they do not exist

### tests/generators/helpers.test.ts

#### Handlebars helpers > eq

- [ ] 同値なら true を返す (L28)
  - EN: should return true for equal values
- [ ] 異なる値なら false を返す (L35)
  - EN: should return false for different values
- [ ] 型が異なれば false（strict equality） (L42)
  - EN: should use strict equality

#### Handlebars helpers > ne

- [ ] 異なる値なら true を返す (L51)
  - EN: should return true for different values

#### Handlebars helpers > and

- [ ] 全値が truthy なら true を返す (L60)
  - EN: should return true when all values are truthy
- [ ] いずれかが falsy なら false を返す (L67)
  - EN: should return false when any value is falsy

#### Handlebars helpers > or

- [ ] いずれかが truthy なら true を返す (L76)
  - EN: should return true when any value is truthy
- [ ] 全値が falsy なら false を返す (L83)
  - EN: should return false when all values are falsy

#### Handlebars helpers > not

- [ ] truthy 値を反転する (L92)
  - EN: should negate truthy value
- [ ] falsy 値を反転する (L99)
  - EN: should negate falsy value

#### Handlebars helpers > length

- [ ] 配列の長さを返す (L112)
  - EN: should return array length
- [ ] オブジェクトのキー数を返す (L119)
  - EN: should return object key count
- [ ] 非コレクションは 0 を返す (L126)
  - EN: should return 0 for non-collection

#### Handlebars helpers > isEmpty

- [ ] 空配列は true を返す (L135)
  - EN: should return true for empty array
- [ ] null/undefined は true を返す (L142)
  - EN: should return true for null
- [ ] 要素がある配列は false を返す (L149)
  - EN: should return false for non-empty array

#### Handlebars helpers > first

- [ ] 配列の先頭要素を返す (L158)
  - EN: should return first element
- [ ] 非配列は undefined を返す (L165)
  - EN: should return empty for non-array

#### Handlebars helpers > take

- [ ] 先頭 N 件を返す (L174)
  - EN: should return first N items
- [ ] 非配列は空配列を返す (L182)
  - EN: should return empty array for non-array

#### Handlebars helpers > entries

- [ ] オブジェクトを key/value エントリ配列に変換する (L191)
  - EN: should convert object to entries
- [ ] null は空配列を返す (L199)
  - EN: should return empty for null

#### Handlebars helpers > percent

- [ ] 小数を 100 倍してパーセントにする (L212)
  - EN: should convert decimal to percentage
- [ ] NaN は "0" を返す (L219)
  - EN: should return 0 for NaN

#### Handlebars helpers > round

- [ ] 数値を四捨五入する (L228)
  - EN: should round number

#### Handlebars helpers > add / sub

- [ ] 加算する (L237)
  - EN: should add numbers
- [ ] 減算する (L244)
  - EN: should subtract numbers

#### Handlebars helpers > commaNumber

- [ ] 数値をカンマ区切りにする (L253)
  - EN: should format number with commas

#### Handlebars helpers > inRange

- [ ] 範囲内なら true を返す (L262)
  - EN: should return true when in range
- [ ] 範囲外なら false を返す (L269)
  - EN: should return false when out of range
- [ ] 境界値を含む (L276)
  - EN: should include boundary values

#### Handlebars helpers > isEven

- [ ] 偶数なら true を返す (L286)
  - EN: should return true for even index
- [ ] 奇数なら false を返す (L294)
  - EN: should return false for odd index

#### Handlebars helpers > truncate

- [ ] 長い文字列を切り詰める (L307)
  - EN: should truncate long string
- [ ] 短い文字列はそのまま返す (L314)
  - EN: should not truncate short string

#### Handlebars helpers > replace

- [ ] 文字列を全置換する（ReDoS 安全） (L323)
  - EN: should replace all occurrences without regex
- [ ] 正規表現特殊文字を含む from でもリテラル置換する (L330)
  - EN: should treat from as literal string, not regex
- [ ] null 入力を安全に処理する (L337)
  - EN: should handle null input

#### Handlebars helpers > slugify

- [ ] スペースをハイフンに変換しスラッグを生成する (L346)
  - EN: should generate slug
- [ ] 特殊文字を除去する (L353)
  - EN: should remove special characters

#### Handlebars helpers > urlEncode

- [ ] URL エンコードする (L362)
  - EN: should URL encode value

#### Handlebars helpers > json (XSS protection)

- [ ] オブジェクトを JSON 文字列に変換する (L375)
  - EN: should stringify object to JSON
- [ ] </script> を含むデータで < をエスケープする (L383)
  - EN: should escape < to prevent script tag breakout
- [ ] ネストされたオブジェクト内の < もエスケープする (L392)
  - EN: should escape < in nested objects
- [ ] null を安全にシリアライズする (L401)
  - EN: should handle null

#### Handlebars helpers > raw

- [ ] HTML をエスケープせずに出力する (L410)
  - EN: should output raw HTML without escaping
- [ ] null は空文字列を返す (L417)
  - EN: should return empty string for null

#### Handlebars helpers > ifExists

- [ ] 値が存在する場合はブロックを表示する (L430)
  - EN: should render block when value exists
- [ ] null の場合はブロックを表示しない (L437)
  - EN: should not render block for null
- [ ] 空文字列の場合はブロックを表示しない (L444)
  - EN: should not render block for empty string
- [ ] else ブロックが使える (L451)
  - EN: should support else block

#### Handlebars helpers > ifNotEmpty

- [ ] 空でない配列ならブロックを表示する (L460)
  - EN: should render block for non-empty array
- [ ] 空配列ならブロックを表示しない (L467)
  - EN: should not render block for empty array
- [ ] 空でないオブジェクトならブロックを表示する (L474)
  - EN: should render block for non-empty object
- [ ] null ならブロックを表示しない (L481)
  - EN: should not render block for null

#### Handlebars helpers > currentYear

- [ ] 現在年を返す (L494)
  - EN: should return current year

### tests/generators/feature-map-styles.test.ts

#### getDefaultFeatureMapConfig

- [ ] デフォルト設定で enabled=true を返す (L61)
  - EN: should return enabled=true by default
- [ ] デフォルトの include パターンに apps glob を含む (L69)
  - EN: should include apps glob patterns in defaults
- [ ] デフォルトの exclude パターンに node_modules とテストファイルを含む (L79)
  - EN: should exclude node_modules and test files by default
- [ ] デフォルトで storybook は undefined を返す (L89)
  - EN: should return undefined storybook by default
- [ ] デフォルトで externalDocs は空配列を返す (L97)
  - EN: should return empty externalDocs by default

#### resolveFeatureMapConfig

- [ ] 引数なしでデフォルト設定を返す (L111)
  - EN: should return default config when no argument provided
- [ ] include のみオーバーライドした場合、他はデフォルト値を保持する (L122)
  - EN: should override only specified fields
- [ ] enabled=false を指定した場合に反映する (L134)
  - EN: should respect enabled=false
- [ ] storybook.enabled=true の場合にデフォルト値で StorybookConfig を生成する (L142)
  - EN: should create storybook config with defaults when enabled
- [ ] storybook のカスタム値を適用する (L156)
  - EN: should apply custom storybook values
- [ ] storybook.enabled=false の場合は storybook を undefined にする (L171)
  - EN: should leave storybook undefined when not enabled

#### collectFiles

- [ ] include パターンごとに globSync を呼び出す (L187)
  - EN: should call globSync for each include pattern
- [ ] globSync に正しい cwd と absolute オプションを渡す (L201)
  - EN: should pass correct cwd and absolute options to globSync
- [ ] 重複ファイルを排除してソートされた配列を返す (L219)
  - EN: should deduplicate and sort results
- [ ] ファイルがない場合は空配列を返す (L236)
  - EN: should return empty array when no files found

#### getStyles

- [ ] コンテナとサマリーカードのCSSクラスを含む (L252)
  - EN: should include container and summary card CSS classes
- [ ] フィルタータブとリストパネルのスタイルを含む (L262)
  - EN: should include filter tab and list panel styles
- [ ] モジュールグループとリストアイテムのスタイルを含む (L272)
  - EN: should include module group and list item styles
- [ ] 5列グリッドレイアウトを含む (L283)
  - EN: should include 5-column grid layout
- [ ] レスポンシブメディアクエリを含む（1200px, 768px, 480px） (L291)
  - EN: should include responsive media queries
- [ ] カテゴリ別のサマリー色を含む (L301)
  - EN: should include category-specific summary colors

#### getScripts

- [ ] タブ切り替えのイベントリスナーを含む (L319)
  - EN: should include tab switching event listener
- [ ] リストパネルの表示切り替えロジックを含む (L331)
  - EN: should include list panel switching logic

### tests/generators/feature-map-html.test.ts

#### groupByModule

- [ ] アイテムをパスのモジュール名でグループ化する (L128)
  - EN: should group items by module name extracted from path
- [ ] モジュール名をアルファベット順でソートする (L143)
  - EN: should sort modules alphabetically
- [ ] 空配列の場合は空のMapを返す (L157)
  - EN: should return empty Map for empty array

#### buildListItem

- [ ] screen タイプでルート情報を含むリストアイテムを生成する (L171)
  - EN: should render screen list item with route
- [ ] action タイプで DB テーブル数を含むリストアイテムを生成する (L183)
  - EN: should render action list item with table count
- [ ] 説明が60文字を超える場合に切り詰める (L193)
  - EN: should truncate description longer than 60 characters
- [ ] 説明がない場合に説明スパンを含まない (L203)
  - EN: should not include description span when description is empty

#### buildModuleListSection

- [ ] アイテムが空の場合「アイテムがありません」を返す (L218)
  - EN: should return empty message when grouped items is empty
- [ ] モジュールグループごとにヘッダーとアイテム数を表示する (L226)
  - EN: should render module groups with header and item count
- [ ] モジュール説明がある場合に表示する (L238)
  - EN: should show module description when provided
- [ ] モジュール詳細ページへのリンクを生成する (L249)
  - EN: should generate link to module detail page

#### buildSummaryCard

- [ ] Features, Screens, Components, Actions, Tables の合計を表示する (L265)
  - EN: should display totals for all item types
- [ ] 生成日時を日本語ロケールで表示する (L301)
  - EN: should display generated date

#### buildScreenCard

- [ ] Screen カードにルート情報とコンポーネント数を含む (L316)
  - EN: should render screen card with route and component count
- [ ] 詳細ページへの正しいリンクを生成する (L333)
  - EN: should generate correct detail page link

#### buildComponentCard

- [ ] Component カードに使用画面数を含む (L344)
  - EN: should render component card with screen count

#### buildActionCard

- [ ] Action カードに DB テーブル数を含む (L361)
  - EN: should render action card with table count

#### buildTableCard

- [ ] Table カードに使用アクション数を含む (L378)
  - EN: should render table card with action count

#### buildFeatureDetail

- [ ] Feature 名とアイテム数のサマリーバッジを表示する (L397)
  - EN: should render feature name and summary badges
- [ ] アイテムがあるセクションのみ表示する (L417)
  - EN: should only render sections for non-empty item types

#### buildDetailPanel

- [ ] Feature がない場合にウェルカムメッセージを表示する (L442)
  - EN: should show welcome message when no features exist
- [ ] Feature がある場合に最初の Feature の詳細を表示する (L451)
  - EN: should show first feature detail when features exist

#### buildLayerView

- [ ] 5つのレイヤー（Features, Screens, Components, Actions, Tables）を表示する (L477)
  - EN: should render all five layer groups
- [ ] 各レイヤーのアイテム数を表示する (L492)
  - EN: should show item counts for each layer

#### buildFeatureView

- [ ] 各 Feature のアイテムをグループ化して表示する (L521)
  - EN: should render feature groups with items
- [ ] 未分類アイテムがある場合に「未分類」セクションを表示する (L542)
  - EN: should render uncategorized section when uncategorized items exist
- [ ] 未分類アイテムがない場合に「未分類」セクションを表示しない (L560)
  - EN: should not render uncategorized section when no uncategorized items

#### buildSidebar

- [ ] レイヤービューと機能ビューの両方を含む (L575)
  - EN: should contain both layer view and feature view

#### generateFeatureMapHtml

- [ ] [feature-map-html] 完全な HTML ドキュメントを生成する (L591)
  - EN: should generate a complete HTML document
- [ ] プロジェクト名を含むタイトルを生成する (L612)
  - EN: should include project name in title
- [ ] フィルタータブに各タイプのアイテム数を表示する (L621)
  - EN: should show filter tabs with item counts
- [ ] サマリーカードを含む (L642)
  - EN: should include summary card
- [ ] モジュール別リストパネルを各タイプに対して生成する (L653)
  - EN: should generate list panels for each type
- [ ] JSON エクスポートリンクを含む (L665)
  - EN: should include JSON export link

### tests/generators/details-styles.test.ts

#### generateTestCaseAnchorId

- [ ] jest フレームワークのプレフィックスを付与してアンカーIDを生成する (L31)
  - EN: should generate anchor ID with jest prefix
- [ ] playwright フレームワークのプレフィックスを付与してアンカーIDを生成する (L39)
  - EN: should generate anchor ID with playwright prefix
- [ ] 英数字以外の文字をハイフンに置換する (L47)
  - EN: should replace non-alphanumeric characters with hyphens

#### getTestFileCategory

- [ ] playwright フレームワークの場合は E2E を返す (L61)
  - EN: should return E2E for playwright framework
- [ ] __tests__/lib/actions/ パスの場合は Server Actions を返す (L68)
  - EN: should return Server Actions for __tests__/lib/actions/ path
- [ ] /lib/actions/ パスの場合は Server Actions を返す (L75)
  - EN: should return Server Actions for /lib/actions/ path
- [ ] __tests__/components/ パスの場合は Components を返す (L82)
  - EN: should return Components for __tests__/components/ path
- [ ] /components/ パスの場合は Components を返す (L89)
  - EN: should return Components for /components/ path
- [ ] 上記に一致しないパスの場合は Other を返す (L96)
  - EN: should return Other for unmatched paths

#### testCategoryToSlug

- [ ] カテゴリ名を小文字のスラッグに変換する (L109)
  - EN: should convert category name to lowercase slug
- [ ] 複数スペースをハイフン1つに変換する (L118)
  - EN: should replace multiple spaces with single hyphen

#### testFileToSlug

- [ ] .test.ts 拡張子を除去してファイル名スラッグを生成する (L131)
  - EN: should remove .test.ts extension
- [ ] .test.tsx 拡張子を除去してファイル名スラッグを生成する (L138)
  - EN: should remove .test.tsx extension
- [ ] .spec.ts 拡張子を除去してファイル名スラッグを生成する (L145)
  - EN: should remove .spec.ts extension
- [ ] .spec.js 拡張子を除去してファイル名スラッグを生成する (L152)
  - EN: should remove .spec.js extension
- [ ] パス部分を除去してファイル名のみを返す (L159)
  - EN: should extract basename from full path

#### generateTestPageUrl

- [ ] depth=0 でカテゴリとファイルスラッグを含むURLを生成する (L172)
  - EN: should generate URL with category and file slug at depth 0
- [ ] depth=1 で ../ プレフィックス付きURLを生成する (L180)
  - EN: should generate URL with ../ prefix at depth 1
- [ ] depth=2 で ../../ プレフィックス付きURLを生成する (L188)
  - EN: should generate URL with ../../ prefix at depth 2

#### categoryLabels

- [ ] 全7カテゴリのラベル・アイコン・色が定義されている (L202)
  - EN: should define labels for all 7 categories
- [ ] happy-path カテゴリが正常系ラベルと緑色を持つ (L215)
  - EN: should have correct label and color for happy-path

#### getCdnScripts

- [ ] highlight.js の CSS と JS のCDNリンクを含む (L229)
  - EN: should include highlight.js CDN links
- [ ] グローバルナビの CSS と JS を含む (L239)
  - EN: should include global nav assets

#### getDetailScripts

- [ ] タブ切り替えの showTab 関数を含む (L254)
  - EN: should include showTab function
- [ ] highlight.js 初期化コードを含む (L263)
  - EN: should include highlight.js initialization

#### getDetailStyles

- [ ] blue アクセントカラーで var(--accent-blue) を使用する (L278)
  - EN: should use var(--accent-blue) for blue accent color
- [ ] green アクセントカラーで var(--accent-green) を使用する (L286)
  - EN: should use var(--accent-green) for green accent color
- [ ] [details-styles/getDetailStyles] 未知のアクセントカラーでデフォルトの blue にフォールバックする (L294)
  - EN: should fallback to blue for unknown accent color
- [ ] 主要なCSSクラスを含む (L302)
  - EN: should include key CSS classes
- [ ] アクセントカラーが tab.active の border-bottom-color に反映される (L317)
  - EN: should apply accent color to tab.active border-bottom-color

#### getModuleSpecificStyles

- [ ] モジュールページ固有のCSSクラスを含む (L331)
  - EN: should include module-specific CSS classes
- [ ] アクセントカラーが stat-value の色に反映される (L344)
  - EN: should apply accent color to stat-value
- [ ] [details-styles/getModuleSpecificStyles] レスポンシブメディアクエリを含む (L352)
  - EN: should include responsive media query
- [ ] [details-styles/getModuleSpecificStyles] 未知のアクセントカラーでデフォルトの blue にフォールバックする (L360)
  - EN: should fallback to blue for unknown accent color

### tests/generators/details-module-page.test.ts

#### buildModuleTestsList

- [ ] テストケースが空の場合「関連するテストが見つかりませんでした」を返す (L107)
  - EN: should return empty message when testCases is empty
- [ ] テストケースをファイル別にグループ化して表示する (L115)
  - EN: should group test cases by file
- [ ] 5件以上のテストケースがある場合に「+N more tests」リンクを表示する (L130)
  - EN: should show more link when file has more than 5 test cases
- [ ] テストケースの件数を表示する (L141)
  - EN: should show test count per file

#### getItemMeta

- [ ] screen タイプでルート情報がある場合にルートスパンを返す (L160)
  - EN: should return route span for screen with route
- [ ] screen タイプでルートがない場合に空文字を返す (L170)
  - EN: should return empty string for screen without route
- [ ] component タイプで使用画面がある場合に画面数を返す (L179)
  - EN: should return screens count for component with usedInScreens
- [ ] action タイプで DB テーブルがある場合にテーブル数を返す (L188)
  - EN: should return tables count for action with dbTables
- [ ] table タイプで使用アクションがある場合にアクション数を返す (L197)
  - EN: should return actions count for table with usedInActions
- [ ] 未知のタイプは空文字を返す (L206)
  - EN: should return empty string for unknown type

#### getModuleStats

- [ ] action タイプで DB テーブルの統計を返す (L220)
  - EN: should return DB Tables stat for action type
- [ ] component タイプで使用画面の統計を返す (L234)
  - EN: should return Used in Screens stat for component type
- [ ] screen タイプでは空文字を返す (L247)
  - EN: should return empty string for screen type
- [ ] action タイプで DB テーブルがない場合は空文字を返す (L256)
  - EN: should return empty string for action type with no dbTables

#### buildTypeItem

- [ ] interface タイプに青色バッジを付与する (L271)
  - EN: should render interface with blue badge
- [ ] enum タイプに値リストを表示する (L286)
  - EN: should render enum with values list
- [ ] ソースコードがある場合にコードブロックを表示する (L303)
  - EN: should render code block when sourceCode is present
- [ ] フィールドが8件を超える場合に「+N more fields」を表示する (L317)
  - EN: should show more fields indicator when fields exceed 8

#### buildUtilityItem

- [ ] constant に黄色バッジと値を表示する (L340)
  - EN: should render constant with yellow badge and value
- [ ] function にシアンバッジとパラメータを表示する (L356)
  - EN: should render function with cyan badge and params
- [ ] 戻り値の型情報を表示する (L377)
  - EN: should render return type when present
- [ ] 説明文がある場合に表示する (L390)
  - EN: should render description when present

#### generateModuleDetailPage

- [ ] 正しいパスに writeFile を呼び出す (L413)
  - EN: should call writeFile with correct output path
- [ ] 生成された HTML にモジュール名とタイプバッジを含む (L429)
  - EN: should generate HTML with module name and type badge
- [ ] Types タブがある場合にタブとコンテンツを含む (L445)
  - EN: should include Types tab when types are provided
- [ ] Utilities タブがある場合にタブとコンテンツを含む (L462)
  - EN: should include Utilities tab when utilities are provided
- [ ] アイテムがない場合「アイテムがありません」を表示する (L479)
  - EN: should show empty message when items is empty
- [ ] 統計情報セクションにアイテム数を表示する (L494)
  - EN: should show item count in stats section
- [ ] title タグにモジュール名とプロジェクト名を含む (L511)
  - EN: should include module name and project name in title tag

### tests/generators/details-html.test.ts

#### getTagLabel

- [ ] 既知のタグ名を日本語ラベルに変換する (L99)
  - EN: should return label for known tag names
- [ ] 未知のタグ名は @タグ名 形式で返す (L109)
  - EN: should return @tagName format for unknown tags

#### generateJSDocSection

- [ ] JSDocが空でフォールバック説明もない場合「説明はありません」を返す (L123)
  - EN: should return no-description message when both jsDoc and fallback are empty
- [ ] フォールバック説明がある場合に概要セクションを生成する (L131)
  - EN: should generate overview section from fallback description
- [ ] JSDoc の @param タグからパラメータテーブルを生成する (L140)
  - EN: should generate params table from @param tags
- [ ] JSDoc の @returns タグから戻り値セクションを生成する (L151)
  - EN: should generate returns section from @returns tag
- [ ] JSDoc の @throws タグから例外セクションを生成する (L161)
  - EN: should generate throws section from @throws tag
- [ ] JSDoc の @example タグから使用例セクションを生成する (L171)
  - EN: should generate examples section from @example tag
- [ ] メタ情報タグ（serverAction, feature 等）からメタ情報セクションを生成する (L180)
  - EN: should generate meta tags section for known meta tags

#### generateTestSectionHTML

- [ ] テストケースが空の場合「テストケースが見つかりませんでした」を表示する (L196)
  - EN: should show no-tests message when testCases is empty
- [ ] テストケースがある場合にカバレッジスコアとテストリストを表示する (L206)
  - EN: should show coverage score and test list when testCases exist
- [ ] カバレッジスコア70以上で緑色を使用する (L234)
  - EN: should use green color for coverage score >= 70
- [ ] カバレッジスコア40未満で赤色を使用する (L250)
  - EN: should use red color for coverage score < 40
- [ ] 不足テストパターンがある場合にバッジを表示する (L266)
  - EN: should show missing patterns when present
- [ ] BDD アノテーション付きテストケースを表示する (L285)
  - EN: should render BDD annotations when present

#### generateDetailHTML

- [ ] 完全な HTML ドキュメントを生成する（DOCTYPE, html, head, body を含む） (L318)
  - EN: should generate a complete HTML document
- [ ] ページタイトルにモジュールプレフィックスと要素名を含む (L330)
  - EN: should include module prefix and element name in page title
- [ ] ページヘッダーにモジュールプレフィックスとファイルパスを含む (L341)
  - EN: should include page header with module prefix and file path
- [ ] 4つのタブ（概要、コード、テスト、関連）を生成する (L353)
  - EN: should generate four tabs: overview, code, tests, related
- [ ] action タイプの場合にアクション種別バッジを表示する (L366)
  - EN: should show action type badge for action type
- [ ] 関連要素のリンクを生成する（コンテキストに要素が存在する場合） (L381)
  - EN: should generate related element links when context has matching elements
- [ ] ルート情報がある場合にメタ情報に含める (L398)
  - EN: should include route information in meta when present
- [ ] title タグにプロジェクト名を含む (L409)
  - EN: should include project name in title tag
- [ ] パンくずナビゲーションが HTML に含まれる (L419)
  - EN: should include breadcrumb navigation in generated HTML

### tests/generators/details-entity-pages.test.ts

#### collectDetailJsonItem

- [ ] 新規アイテムを ctx.detailsJsonItems に追加する (L190)
  - EN: should add new item to ctx.detailsJsonItems
- [ ] 同一キーのアイテムが既存の場合に related をマージする (L208)
  - EN: should merge related items when same key exists
- [ ] 重複する related アイテムを排除する (L234)
  - EN: should deduplicate related items
- [ ] testCoverage 情報を正しく設定する (L260)
  - EN: should set testCoverage information correctly
- [ ] @errorCodes タグからエラーコードをパースする (L283)
  - EN: should parse error codes from @errorCodes tag
- [ ] @authLevel タグから認証レベルを設定する (L312)
  - EN: should set authLevel from @authLevel tag
- [ ] @csrfProtection タグから CSRF 保護設定を読み取る (L336)
  - EN: should parse csrfProtection from tag
- [ ] app フィールドに inferAppFromPath の結果を設定する (L360)
  - EN: should set app field from inferAppFromPath

#### generateScreenDetailPage

- [ ] Screen 詳細ページの HTML を生成して writeFile で書き込む (L383)
  - EN: should generate and write screen detail page
- [ ] ctx に JSON データを収集する (L407)
  - EN: should collect JSON data in ctx

#### generateComponentDetailPage

- [ ] Component 詳細ページの HTML を生成して writeFile で書き込む (L431)
  - EN: should generate and write component detail page

#### generateActionDetailPage

- [ ] Action 詳細ページの HTML を生成して writeFile で書き込む (L459)
  - EN: should generate and write action detail page
- [ ] ソースコードに認証パターンが含まれる場合に hasAuth=true で分析する (L481)
  - EN: should detect auth patterns in source code
- [ ] dbTables がある場合に hasDb=true で分析する (L503)
  - EN: should detect DB usage from dbTables

#### generateTableDetailPage

- [ ] Table 詳細ページの HTML を生成して writeFile で書き込む (L530)
  - EN: should generate and write table detail page
- [ ] analyzeTestCoverage を hasDb=true で呼び出す (L551)
  - EN: should call analyzeTestCoverage with hasDb=true

#### generateModuleItemDetailPage

- [ ] Module 詳細ページの HTML を生成して writeFile で書き込む (L577)
  - EN: should generate and write module item detail page
- [ ] featureName を moduleName として使用する (L600)
  - EN: should use featureName as moduleName
- [ ] 7 種類の related タイプ全てを HTML データに含む (L617)
  - EN: should include all 7 related types in HTML data

### tests/generators/data-processor.test.ts

#### loadPortalData

- [ ] JSON ファイルが存在しない場合は null を返す (L120)
  - EN: should return null fields when JSON files do not exist
- [ ] 全データが null の場合の available フラグが正しい (L141)
  - EN: should set all available flags to false when no data
- [ ] feature-map.json が存在する場合は読み込む (L164)
  - EN: should load feature-map.json when it exists
- [ ] test-cases.json が存在する場合は読み込む (L178)
  - EN: should load test-cases.json when it exists
- [ ] db-schema.json が存在する場合は読み込む (L192)
  - EN: should load db-schema.json when it exists
- [ ] i18n.json が存在する場合は読み込む (L206)
  - EN: should load i18n.json when it exists
- [ ] packages.json が存在する場合は読み込む (L219)
  - EN: should load packages.json when it exists
- [ ] api-tools.json が存在する場合は読み込む (L232)
  - EN: should load api-tools.json when it exists
- [ ] coverage.json が存在する場合は読み込む (L245)
  - EN: should load coverage.json when it exists
- [ ] github-data.json が存在する場合は読み込む (L257)
  - EN: should load github-data.json when it exists
- [ ] overview.md がプロジェクトルートに存在する場合は読み込む (L274)
  - EN: should load overview.md from project root
- [ ] OVERVIEW.md がなく README.md がある場合はフォールバックする (L288)
  - EN: should fall back to README.md when OVERVIEW.md does not exist
- [ ] JSON パースエラーの場合は null を返す (L305)
  - EN: should return null when JSON is malformed
- [ ] applications.json が存在しない場合は自動生成する (L322)
  - EN: should auto-generate applications when applications.json is missing
- [ ] featureMap がある場合は Web アプリを自動生成する (L334)
  - EN: should auto-generate Web app when featureMap exists
- [ ] apiTools がある場合は MCP アプリを自動生成する (L349)
  - EN: should auto-generate MCP app when apiTools exists
- [ ] testCases から Web/MCP のテスト数を分離カウントする (L364)
  - EN: should separate test counts between Web and MCP
- [ ] dbSchema がある場合は shared sections にテーブル数を含む (L384)
  - EN: should include table count in shared sections when dbSchema exists

### tests/analyzers/feature-map-references.test.ts

#### feature-map-references > mergeArrays

- [ ] 2つの配列を重複排除してマージする (L41)
  - EN: should merge arrays without duplicates
- [ ] 空配列同士のマージを正しく処理する (L49)
  - EN: should handle empty arrays

#### feature-map-references > buildTableReverseReferences

- [ ] ActionのdbTablesからTableアイテムへの逆参照を構築する (L60)
  - EN: should build reverse references from action dbTables to table items
- [ ] 逆参照の重複を排除する（内部でSetを使用） (L102)
  - EN: should deduplicate reverse references
- [ ] dbTablesを持たないActionはTableアイテムに影響しない (L130)
  - EN: should handle actions without dbTables
- [ ] 空のアイテム配列でもエラーを発生させない (L155)
  - EN: should handle empty items array
- [ ] テーブル名の大文字小文字を区別せずにマッチングする (L163)
  - EN: should match table names case-insensitively

#### feature-map-references > mergeInferredReferences

- [ ] ScreenのusedComponentsにfileUsagesからコンポーネント参照をマージする (L190)
  - EN: should merge component references into screen items via fileUsages
- [ ] ScreenのusedActionsにfileUsagesからアクション参照をマージする (L219)
  - EN: should merge action references into screen items via fileUsages
- [ ] ComponentのusedInScreensにreverseRefsから逆参照をマージする (L248)
  - EN: should merge reverse component references from reverseRefs
- [ ] 既存の参照を保持しつつ重複なくマージする (L280)
  - EN: should not duplicate existing references when merging
- [ ] 空の参照解析結果の場合はアイテムを変更しない (L311)
  - EN: should not modify items when reference result is empty
- [ ] ActionのusedInScreensにreverseRefsから逆参照をマージする (L331)
  - EN: should merge reverse action references from reverseRefs

#### feature-map-references > buildModuleReferences

- [ ] fileUsagesからモジュール間の相互参照を構築する (L365)
  - EN: should build module-to-module references from fileUsages
- [ ] 空のモジュールアイテム配列でもエラーを発生させない (L408)
  - EN: should handle empty items gracefully
- [ ] モジュール以外のアイテムタイプには影響しない (L418)
  - EN: should not affect non-module items

### tests/analyzers/details-test-analysis.test.ts

#### details-test-analysis > categorizeTest

- [ ] 認証関連のテスト名を auth カテゴリに分類する (L24)
  - EN: should categorize auth-related tests
- [ ] ログイン・ログアウト関連のテスト名を auth カテゴリに分類する (L32)
  - EN: should categorize login/logout tests as auth
- [ ] エラーハンドリング関連のテスト名を error-handling カテゴリに分類する (L40)
  - EN: should categorize error handling tests
- [ ] バリデーション関連のテスト名を validation カテゴリに分類する (L48)
  - EN: should categorize validation tests
- [ ] エッジケース関連のテスト名を edge-case カテゴリに分類する (L56)
  - EN: should categorize edge-case tests
- [ ] 特定カテゴリに該当しないテスト名をデフォルトの happy-path に分類する (L64)
  - EN: should categorize happy-path tests as default
- [ ] カテゴリ分類結果にサマリー文字列が含まれることを確認する (L72)
  - EN: should include summary in result
- [ ] 認証キーワードとエラーキーワードが競合する場合に auth を優先する (L81)
  - EN: should prioritize auth over error keywords

#### details-test-analysis > extractTestIntent

- [ ] should プレフィックスを除去してテストの意図を抽出する (L92)
  - EN: should extract intent from 
- [ ] should プレフィックスがない場合は元のテスト名をそのまま返す (L100)
  - EN: should return original when no 
- [ ] 標準形式でないテスト名はそのまま返す (L108)
  - EN: should return original for non-standard format

#### details-test-analysis > analyzeTestCoverage

- [ ] テストケースが空の場合にカバレッジスコア0と推奨事項を返す (L118)
  - EN: should return zero score for empty test cases
- [ ] テストカテゴリが多いほどカバレッジスコアが高くなる (L127)
  - EN: should score higher with more test categories
- [ ] 認証ありで認証テストがない場合に認証テストを推奨する (L141)
  - EN: should recommend auth tests when hasAuth is true and no auth tests
- [ ] DB利用ありでエッジケーステストがない場合にカバレッジに反映する (L152)
  - EN: should recommend DB tests when hasDb is true and no edge-case tests
- [ ] テストケースをカテゴリ別にグループ化して返す (L164)
  - EN: should organize tests by category

#### details-test-analysis > findTestCasesForElement

- [ ] describe名で一致するテストケースを検索して返す (L209)
  - EN: should find tests by describe name matching
- [ ] ファイルパスで一致するテストケースを検索して返す (L218)
  - EN: should find tests by file path matching
- [ ] 関連のない要素名の場合は空配列を返す (L226)
  - EN: should return empty array for unrelated element
- [ ] 検索されたテストケースにカテゴリとサマリーが付与される (L234)
  - EN: should categorize found test cases

#### details-test-analysis > findTestCasesForModule

- [ ] actionモジュール名からパスベースでテストケースを検索する (L276)
  - EN: should find tests for action module by path
- [ ] screenモジュール名からパスベースでテストケースを検索する (L285)
  - EN: should find tests for screen module by path
- [ ] 関連テストが存在しないモジュールの場合は空配列を返す (L293)
  - EN: should return empty for module with no related tests
- [ ] describe名にモジュール名を含むテストケースを検索する (L301)
  - EN: should find tests by describe matching

### tests/commands/typedoc.test.ts

#### typedocCommand

- [ ] TypeDoc 未インストール時に exit code 1 を返す (L73)
  - EN: should return 1 when typedoc is not installed
- [ ] エントリポイント未設定時に return する (L83)
  - EN: should return early when no entry points configured
- [ ] エントリポイントが存在しない場合に exit code 1 を返す (L95)
  - EN: should return 1 when no valid entry points found
- [ ] 正常系: TypeDoc を実行する (L110)
  - EN: should execute typedoc when properly configured
- [ ] TypeDoc 実行失敗時に exit code 1 を返す (L132)
  - EN: should return 1 when typedoc generation fails
- [ ] markdown プラグインが利用可能な場合にプラグインを追加する (L149)
  - EN: should add markdown plugin when available

### tests/commands/search-index.test.ts

#### Search Index Command > normalizeText

- [ ] テキストの正規化: 小文字変換と余分な空白削除 (L23)
  - EN: should normalize text by lowercasing and removing extra whitespace
- [ ] 空文字列とnullの処理 (L32)
  - EN: should handle empty strings

#### Search Index Command > tokenize

- [ ] 英語テキストをトークン化できる (L42)
  - EN: should tokenize English text into words
- [ ] 日本語テキストをN-gramでトークン化できる (L52)
  - EN: should tokenize Japanese text using n-grams
- [ ] 混合テキスト(日本語と英語)を処理できる (L63)
  - EN: should handle mixed Japanese and English text

#### Search Index Command > extractTestCaseDocuments

- [ ] テストケースからSearchDocumentを生成できる (L74)
  - EN: should extract search documents from test cases
- [ ] @testdocがないテストケースは英語名で登録される (L105)
  - EN: should use English name for tests without @testdoc

#### Search Index Command > extractTestCaseDocuments > User Management

- [ ] ユーザーを作成できる (L80)
  - EN: should create a user
- [ ] ユーザーを削除できる (L87)
  - EN: should delete a user

#### Search Index Command > extractMarkdownDocuments

- [ ] MarkdownファイルからSearchDocumentを生成できる (L125)
  - EN: should extract search documents from markdown content
- [ ] frontmatterからタイトルを抽出できる (L145)
  - EN: should extract title from frontmatter

#### Search Index Command > buildSearchIndex

- [ ] SearchDocumentの配列からインデックスJSONを生成できる (L165)
  - EN: should build search index from documents array
- [ ] 空の配列でも正常に処理できる (L193)
  - EN: should handle empty documents array

#### Search Index Command > extractSearchDocuments

- [ ] 複数のソースからドキュメントを抽出・統合できる (L205)
  - EN: should extract and combine documents from multiple sources

#### SearchDocument Interface

- [ ] SearchDocumentが正しい構造を持つ (L241)
  - EN: should have correct structure
- [ ] 全てのドキュメントタイプをサポート (L262)
  - EN: should support all document types

### tests/commands/screenshots.test.ts

#### screenshotsCommand

- [ ] screenshots が disabled の場合に早期 return する (L92)
  - EN: should return early when screenshots is disabled
- [ ] スクリーンが見つからない場合に早期 return する (L106)
  - EN: should return early when no screens found
- [ ] feature-map ソースからスクリーンを収集する (L119)
  - EN: should collect screens from feature-map source
- [ ] config ソースからスクリーンを収集する (L152)
  - EN: should collect screens from config source

### tests/commands/portal.test.ts

#### portalCommand

- [ ] PortalGenerator を使用してポータルを生成する (L77)
  - EN: should generate portal using PortalGenerator
- [ ] output オプションを渡すと指定パスを使用する (L88)
  - EN: should use output option when provided
- [ ] PortalGenerator のエラーを伝播する (L103)
  - EN: should propagate errors from PortalGenerator
- [ ] api-tools.json が存在しない場合は runApiTools を呼ぶ (L114)
  - EN: should call runApiTools when api-tools.json does not exist
- [ ] api-tools.json が既に存在する場合は runApiTools をスキップする (L125)
  - EN: should skip runApiTools when api-tools.json already exists
- [ ] runApiTools が失敗してもポータル生成は続行する (L138)
  - EN: should continue portal generation when runApiTools fails

### tests/commands/packages.test.ts

#### Packages Command > scanPackageModules

- [ ] パッケージのモジュールをスキャンできる (L23)
  - EN: should scan package modules from TypeScript files
- [ ] エクスポートされた関数を検出できる (L51)
  - EN: should detect exported functions
- [ ] エクスポートされた型を検出できる (L76)
  - EN: should detect exported types and interfaces
- [ ] エクスポートされた定数を検出できる (L97)
  - EN: should detect exported constants
- [ ] ファイルにエクスポートがない場合はnullを返す (L113)
  - EN: should return null for files without exports

#### Packages Command > buildPackagesData

- [ ] 空のパッケージリストでも正しくデータを構築できる (L132)
  - EN: should build data for empty package list
- [ ] パッケージの統計情報を正しく計算できる (L145)
  - EN: should calculate package statistics correctly
- [ ] 複数パッケージのサマリーを正しく計算できる (L189)
  - EN: should calculate summary for multiple packages

### tests/commands/overview.test.ts

#### overviewCommand

- [ ] 正常系で HTML ファイルを生成する (L79)
  - EN: should generate overview HTML file
- [ ] overview が disabled の場合に早期 return する (L91)
  - EN: should return early when overview is disabled
- [ ] package.json が存在しない場合もエラーにならない (L105)
  - EN: should handle missing package.json gracefully
- [ ] feature-map.json の統計を含める (L116)
  - EN: should include feature-map stats when available

### tests/commands/link-docs.test.ts

#### linkDocsCommand

- [ ] ソースファイルもテストもない場合に正常に完了する (L104)
  - EN: should complete successfully with no source or test files
- [ ] JSON レポートにサマリーを含める (L113)
  - EN: should include summary in JSON report
- [ ] ソースファイルにマッチするテストがない場合 missing ステータスにする (L131)
  - EN: should mark source files without matching tests as missing
- [ ] @skip-test アノテーションのあるソースを skipped にする (L151)
  - EN: should mark source files with @skip-test as skipped

### tests/commands/impact.test.ts

#### impactCommand

- [ ] details.json が存在しない場合に return する (L71)
  - EN: should return early when details.json does not exist
- [ ] 空の details で正常に処理する (L82)
  - EN: should handle empty details
- [ ] 特定ターゲットの影響分析を行う (L95)
  - EN: should analyze impact for a specific target
- [ ] 見つからないターゲットの場合に return する (L126)
  - EN: should return when target is not found
- [ ] JSON 形式で出力する (L146)
  - EN: should output JSON format
- [ ] HTML 形式で出力する (L166)
  - EN: should output HTML format
- [ ] 推移的依存を検出する (L189)
  - EN: should detect transitive dependencies

### tests/commands/i18n.test.ts

#### i18nCommand

- [ ] メッセージファイルが見つからない場合に早期 return する (L75)
  - EN: should return early when no message files found
- [ ] メッセージファイルが見つかった場合に JSON と HTML を出力する (L86)
  - EN: should write JSON and HTML when message files are found
- [ ] JSON レポートに正しい統計を含める (L103)
  - EN: should include correct stats in JSON report
- [ ] i18n が disabled の場合に早期 return する (L135)
  - EN: should return early when i18n is disabled

### tests/commands/feature-map.test.ts

#### Feature Map Command > parseFeatureMapTags

- [ ] @screen タグを解析できる (L25)
  - EN: should parse @screen tag
- [ ] @component タグを解析できる (L48)
  - EN: should parse @component tag
- [ ] @serverAction タグを解析できる (L73)
  - EN: should parse @serverAction tag
- [ ] @dbTable タグを解析できる (L101)
  - EN: should parse @dbTable tag
- [ ] @usedComponents タグを解析できる (L124)
  - EN: should parse @usedComponents tag
- [ ] 複数のJSDocブロックを解析できる (L147)
  - EN: should parse multiple JSDoc blocks in a file
- [ ] featureタグがない場合はuncategorizedとして扱う (L171)
  - EN: should treat items without @feature as uncategorized
- [ ] JSDocブロックから説明文を正しく抽出できる (L190)
  - EN: should extract description from JSDoc

#### Feature Map Command > buildFeatureMap

- [ ] 空の入力で空のFeatureMapを返す (L214)
  - EN: should return empty feature map for empty input
- [ ] featureごとにアイテムをグループ化できる (L227)
  - EN: should group items by feature
- [ ] featureがないアイテムをuncategorizedに分類する (L269)
  - EN: should categorize items without feature as uncategorized
- [ ] 4層(screen, component, action, table)を正しく分類する (L299)
  - EN: should correctly categorize all 4 layers
- [ ] レイヤー間のリレーションを構築できる (L347)
  - EN: should build relationships between layers

#### Feature Map Command > FeatureMap Interface

- [ ] ScreenItemの構造が正しい (L382)
  - EN: should have correct ScreenItem structure
- [ ] ComponentItemの構造が正しい (L400)
  - EN: should have correct ComponentItem structure
- [ ] ActionItemの構造が正しい (L417)
  - EN: should have correct ActionItem structure
- [ ] TableItemの構造が正しい (L434)
  - EN: should have correct TableItem structure
- [ ] FeatureMapの全体構造が正しい (L449)
  - EN: should have correct FeatureMap structure

#### Feature Map Command > Edge Cases

- [ ] 空のファイルを処理できる (L483)
  - EN: should handle empty files
- [ ] JSDocコメントがないファイルを処理できる (L491)
  - EN: should handle files without JSDoc comments
- [ ] 不正なJSDocコメントを無視する (L504)
  - EN: should ignore invalid JSDoc comments
- [ ] カンマ区切りのリストを正しく解析する (L526)
  - EN: should correctly parse comma-separated lists
- [ ] 日本語の説明文を正しく抽出できる (L544)
  - EN: should correctly extract Japanese descriptions

### tests/commands/details.test.ts

#### detailsCommand

- [ ] feature-map.json が存在しない場合に return する (L109)
  - EN: should return early when feature-map.json does not exist
- [ ] 空の feature-map を正常に処理する (L120)
  - EN: should handle empty feature map
- [ ] 各エンティティの詳細ページを生成する (L137)
  - EN: should generate detail pages for each entity type

### tests/commands/details-context.test.ts

#### details-context > createDetailsContext

- [ ] 空のDetailsContextを初期化し、全要素マップが空のMapインスタンスであることを確認する (L24)
  - EN: should create an empty context

#### details-context > extractModuleName

- [ ] ルートグループディレクトリ（括弧付き）からモジュール名を抽出する (L40)
  - EN: should extract module from route group directory
- [ ] 動的ルートセグメント（[id]等）をスキップしてモジュール名を抽出する (L47)
  - EN: should skip dynamic route segments
- [ ] 除外ディレクトリ（app, lib等）を避けて意味のあるディレクトリ名を使用する (L54)
  - EN: should use meaningful directory name, not excluded dirs
- [ ] 意味のあるディレクトリが見つからない場合はファイル名をフォールバックとして使用する (L61)
  - EN: should fall back to filename when no meaningful dir found
- [ ] Windows形式のパス区切り（バックスラッシュ）を正しく処理する (L68)
  - EN: should handle Windows-style paths
- [ ] 一般的な除外ディレクトリ（lib等）をスキップして上位の意味あるディレクトリを探す (L75)
  - EN: should skip common excluded directories
- [ ] ネストされたモジュールパスから正しいモジュール名を抽出する (L83)
  - EN: should handle nested module paths

#### details-context > getElementFullKey

- [ ] モジュール名と要素名から「module/name」形式のフルキーを生成する (L92)
  - EN: should generate key with module/name format

#### details-context > getExistingMap

- [ ] linkTypeが「screen」の場合にscreensマップを返す (L112)
  - EN: should return screens map for 
- [ ] linkTypeが「component」の場合にcomponentsマップを返す (L120)
  - EN: should return components map for 
- [ ] linkTypeが「action」の場合にactionsマップを返す (L128)
  - EN: should return actions map for 
- [ ] linkTypeが「module」の場合にmodulesマップを返す (L136)
  - EN: should return modules map for 
- [ ] linkTypeが「table」の場合にtablesマップを返す (L144)
  - EN: should return tables map for 
- [ ] 不明なlinkTypeの場合に空のMapを返す (L152)
  - EN: should return empty map for unknown linkType

#### details-context > findElementLink

- [ ] 要素名でリンクを検索しモジュール情報を返す (L171)
  - EN: should find element link by name
- [ ] 同名要素が複数モジュールに存在する場合は最初の一致を返す (L179)
  - EN: should return first match when multiple modules have same element name
- [ ] 存在しない要素名を検索した場合にnullを返す (L188)
  - EN: should return null for non-existing element
- [ ] 不明なlinkTypeで検索した場合にnullを返す (L196)
  - EN: should return null for unknown linkType

#### details-context > extractFunctionCode

- [ ] 名前付き関数をJSDocコメントごと抽出し他の関数を含めない (L206)
  - EN: should extract a named function with JSDoc
- [ ] constアロー関数の定義を正しく抽出する (L232)
  - EN: should extract const arrow function
- [ ] 対象関数が見つからない場合はソースコード全体を返す (L251)
  - EN: should return full source when target not found
- [ ] async関数の定義を正しく抽出する (L260)
  - EN: should handle async function
- [ ] ネストされた波括弧（map内のif文等）を正しく追跡し関数境界を判定する (L275)
  - EN: should handle nested braces correctly

### tests/commands/deps.test.ts

#### depsCommand

- [ ] dependency-cruiser 未インストール時に exit code 1 を返す (L84)
  - EN: should return 1 when dependency-cruiser is not installed
- [ ] 対象パスが存在しない場合に return する (L94)
  - EN: should return early when no target paths exist
- [ ] JSON 生成が成功する (L106)
  - EN: should generate JSON output successfully
- [ ] 全フォーマット失敗時に exit code 1 を返す (L121)
  - EN: should return 1 when all formats fail

### tests/commands/coverage.test.ts

#### parseIstanbulCoverage

- [ ] 有効なIstanbul JSONを解析してFileCoverage配列を返す (L28)
  - EN: should parse valid Istanbul JSON and return FileCoverage array
- [ ] 空のJSONでは空の配列を返す (L62)
  - EN: should return empty array for empty JSON
- [ ] totalエントリはファイル一覧から除外される (L70)
  - EN: should exclude total entry from file list

#### calculateTotalCoverage

- [ ] ファイル一覧からtotal coverageを計算する (L89)
  - EN: should calculate total coverage from file list
- [ ] 空のファイル一覧では0%を返す (L118)
  - EN: should return 0% for empty file list
- [ ] totalが0の場合は0%を返す (L130)
  - EN: should return 0% when total is 0

#### checkThresholds

- [ ] 全ての閾値を満たすと成功を返す (L158)
  - EN: should return success when all thresholds are met
- [ ] lines閾値未満で失敗を返す (L175)
  - EN: should return failure when lines threshold is not met
- [ ] 複数の閾値未満で全ての失敗を報告する (L192)
  - EN: should report all failures when multiple thresholds are not met
- [ ] 閾値が未定義の場合はチェックをスキップする (L209)
  - EN: should skip check for undefined thresholds

#### getCoverageStatus

- [ ] 90%以上は'high'を返す (L233)
  - EN: should return 
- [ ] 70-89%は'medium'を返す (L242)
  - EN: should return 
- [ ] 70%未満は'low'を返す (L251)
  - EN: should return 

#### formatCoverageReport

- [ ] summary形式でサマリー情報を出力する (L279)
  - EN: should output summary information in summary format
- [ ] json形式で有効なJSONを出力する (L292)
  - EN: should output valid JSON in json format
- [ ] html形式でHTMLダッシュボードを出力する (L304)
  - EN: should output HTML dashboard in html format
- [ ] html出力にファイル別カバレッジ表を含む (L315)
  - EN: should include file coverage table in html output
- [ ] html出力でカバレッジに応じた色分けを行う (L328)
  - EN: should color code coverage in html output

#### Coverage integration

- [ ] ファイル解析から閾値チェックまでの完全なワークフローが動作する (L341)
  - EN: should work through complete workflow from parsing to threshold check

### tests/commands/test-cases/bdd-annotations.test.ts

#### BDD Annotations Parser

- [ ] Given-When-Then の基本パターンをパースできる (L17) [BDD]
  - EN: should parse basic Given-When-Then pattern
  - **Given**: BDD アノテーションを含む JSDoc コメント
  - **When**: extractTestDocComment を実行
  - **Then**: bdd オブジェクトに given/when/then が含まれる
- [ ] @and タグを複数パースできる (L44) [BDD]
  - EN: should parse multiple @and tags
  - **Given**: 複数の @and タグを含む JSDoc コメント
  - **When**: extractTestDocComment を実行
  - **Then**: bdd.and 配列に全ての追加条件が含まれる
- [ ] 従来のタグと BDD タグを混在できる (L69) [BDD]
  - EN: should parse mixed traditional and BDD annotations
  - **Given**: @testdoc, @purpose, @given, @when, @then を含むコメント
  - **When**: extractTestDocComment を実行
  - **Then**: 全てのタグが正しくパースされる
- [ ] BDD タグがない場合は bdd プロパティが undefined (L103) [BDD]
  - EN: should return undefined bdd when no BDD tags present
  - **Given**: BDD タグを含まない JSDoc コメント
  - **When**: extractTestDocComment を実行
  - **Then**: bdd プロパティが undefined
- [ ] 部分的な BDD タグでも bdd オブジェクトが生成される (L125) [BDD]
  - EN: should handle partial BDD annotations
  - **Given**: @given のみを含む JSDoc コメント
  - **When**: extractTestDocComment を実行
  - **Then**: bdd.given が設定され、when/then は undefined

## ファイル別統計

| ファイル | フレームワーク | describe数 | テスト数 |
|----------|---------------|-----------|---------|
| tests/cli.test.ts | jest | 1 | 3 |
| tests/parsers/test-categorization.test.ts | jest | 5 | 21 |
| tests/parsers/test-annotations.test.ts | jest | 11 | 43 |
| tests/parsers/screenshot-annotations.test.ts | jest | 2 | 15 |
| tests/parsers/feature-map-utils.test.ts | jest | 4 | 25 |
| tests/parsers/feature-map-type-extraction.test.ts | jest | 7 | 39 |
| tests/parsers/feature-map-tags.test.ts | jest | 6 | 30 |
| tests/parsers/drizzle-schema.test.ts | jest | 2 | 19 |
| tests/parsers/details-zod.test.ts | jest | 2 | 13 |
| tests/parsers/details-jsdoc.test.ts | jest | 6 | 27 |
| tests/generators/test-cases-styles.test.ts | jest | 13 | 41 |
| tests/generators/test-cases-main.test.ts | jest | 3 | 17 |
| tests/generators/test-cases-hierarchy.test.ts | jest | 2 | 14 |
| tests/generators/portal-generator.test.ts | jest | 1 | 16 |
| tests/generators/helpers.test.ts | jest | 25 | 56 |
| tests/generators/feature-map-styles.test.ts | jest | 5 | 23 |
| tests/generators/feature-map-html.test.ts | jest | 14 | 34 |
| tests/generators/details-styles.test.ts | jest | 10 | 34 |
| tests/generators/details-module-page.test.ts | jest | 6 | 29 |
| tests/generators/details-html.test.ts | jest | 4 | 24 |
| tests/generators/details-entity-pages.test.ts | jest | 6 | 19 |
| tests/generators/data-processor.test.ts | jest | 1 | 18 |
| tests/analyzers/feature-map-references.test.ts | jest | 4 | 16 |
| tests/analyzers/details-test-analysis.test.ts | jest | 5 | 24 |
| tests/commands/typedoc.test.ts | jest | 1 | 6 |
| tests/commands/search-index.test.ts | jest | 8 | 16 |
| tests/commands/screenshots.test.ts | jest | 1 | 4 |
| tests/commands/portal.test.ts | jest | 1 | 6 |
| tests/commands/packages.test.ts | jest | 2 | 8 |
| tests/commands/overview.test.ts | jest | 1 | 4 |
| tests/commands/link-docs.test.ts | jest | 1 | 4 |
| tests/commands/impact.test.ts | jest | 1 | 7 |
| tests/commands/i18n.test.ts | jest | 1 | 4 |
| tests/commands/feature-map.test.ts | jest | 4 | 23 |
| tests/commands/details.test.ts | jest | 1 | 3 |
| tests/commands/details-context.test.ts | jest | 6 | 24 |
| tests/commands/deps.test.ts | jest | 1 | 4 |
| tests/commands/coverage.test.ts | jest | 6 | 19 |
| tests/commands/test-cases/bdd-annotations.test.ts | jest | 1 | 5 |
