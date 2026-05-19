/**
 * Handlebars カスタムヘルパー登録
 *
 * ポータルテンプレートで使用するカスタムヘルパーを登録する。
 */
import Handlebars from "handlebars";
/**
 * 全カスタムヘルパーを登録する
 */
export function registerHelpers() {
    // 等値比較
    Handlebars.registerHelper("eq", function (a, b) {
        return a === b;
    });
    // 不等値比較
    Handlebars.registerHelper("ne", function (a, b) {
        return a !== b;
    });
    // 論理 AND
    Handlebars.registerHelper("and", function (...args) {
        // 最後の引数は Handlebars のオプションオブジェクト
        const values = args.slice(0, -1);
        return values.every(Boolean);
    });
    // 論理 OR
    Handlebars.registerHelper("or", function (...args) {
        const values = args.slice(0, -1);
        return values.some(Boolean);
    });
    // 論理 NOT
    Handlebars.registerHelper("not", function (value) {
        return !value;
    });
    // 配列の長さ取得
    Handlebars.registerHelper("length", function (arr) {
        if (Array.isArray(arr))
            return arr.length;
        if (typeof arr === "object" && arr !== null)
            return Object.keys(arr).length;
        return 0;
    });
    // 配列・オブジェクトが空かどうか判定
    Handlebars.registerHelper("isEmpty", function (value) {
        if (!value)
            return true;
        if (Array.isArray(value))
            return value.length === 0;
        if (typeof value === "object")
            return Object.keys(value).length === 0;
        return false;
    });
    // 配列の先頭要素を取得
    Handlebars.registerHelper("first", function (arr) {
        if (Array.isArray(arr))
            return arr[0];
        return undefined;
    });
    // 数値を 100 倍してパーセント表示
    Handlebars.registerHelper("percent", function (value) {
        const num = Number(value);
        if (isNaN(num))
            return "0";
        return Math.round(num * 100).toString();
    });
    // 数値を丸める
    Handlebars.registerHelper("round", function (value) {
        return Math.round(Number(value));
    });
    // JSON エンコード（テンプレート内でのデータ埋め込み用）
    // </script> による HTML パーサー脱出を防ぐため < をエスケープ
    Handlebars.registerHelper("json", function (value) {
        return JSON.stringify(value).replaceAll("<", "\\u003c");
    });
    // HTML エスケープなし出力（信頼できるデータのみに使用）
    Handlebars.registerHelper("raw", function (value) {
        return new Handlebars.SafeString(String(value ?? ""));
    });
    // URL エンコード
    Handlebars.registerHelper("urlEncode", function (value) {
        return encodeURIComponent(String(value ?? ""));
    });
    // 文字列切り詰め
    Handlebars.registerHelper("truncate", function (str, len) {
        const s = String(str ?? "");
        const l = Number(len) || 100;
        if (s.length <= l)
            return s;
        return s.slice(0, l) + "…";
    });
    // 数値のカンマ区切り
    Handlebars.registerHelper("commaNumber", function (value) {
        return Number(value).toLocaleString("ja-JP");
    });
    // 配列から最初の N 件を取得
    Handlebars.registerHelper("take", function (arr, n) {
        if (!Array.isArray(arr))
            return [];
        return arr.slice(0, Number(n) || 5);
    });
    // オブジェクトのエントリ配列を返す
    Handlebars.registerHelper("entries", function (obj) {
        if (!obj || typeof obj !== "object")
            return [];
        return Object.entries(obj).map(([key, value]) => ({ key, value }));
    });
    // 条件分岐: 値が存在する場合のみ表示
    Handlebars.registerHelper("ifExists", function (value, options) {
        if (value !== null && value !== undefined && value !== "") {
            return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : "";
    });
    // 配列に要素があるかどうかの条件分岐
    Handlebars.registerHelper("ifNotEmpty", function (arr, options) {
        const hasItems = Array.isArray(arr)
            ? arr.length > 0
            : typeof arr === "object" && arr !== null
                ? Object.keys(arr).length > 0
                : false;
        if (hasItems) {
            return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : "";
    });
    // 文字列置換
    Handlebars.registerHelper("replace", function (str, from, to) {
        return String(str ?? "").replaceAll(String(from ?? ""), String(to ?? ""));
    });
    // スラッシュをハイフンに変換（URL slug 生成）
    Handlebars.registerHelper("slugify", function (value) {
        return String(value ?? "")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "");
    });
    // 現在年（フッター用）
    Handlebars.registerHelper("currentYear", function () {
        return new Date().getFullYear();
    });
    // インデックス (0-based) が偶数かどうか
    Handlebars.registerHelper("isEven", function (index) {
        return Number(index) % 2 === 0;
    });
    // 加算
    Handlebars.registerHelper("add", function (a, b) {
        return Number(a) + Number(b);
    });
    // 減算
    Handlebars.registerHelper("sub", function (a, b) {
        return Number(a) - Number(b);
    });
    // 範囲内かどうか (min <= value <= max)
    Handlebars.registerHelper("inRange", function (value, min, max) {
        const v = Number(value);
        return v >= Number(min) && v <= Number(max);
    });
}
//# sourceMappingURL=helpers.js.map