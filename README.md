# @koyori-app/openapi-vue-query

Thin Vue Query helpers built on `openapi-fetch`.

## API

- `createClient(fetchClient)`
- `queryOptions(method, path, init?, options?)`
- `useQuery(method, path, init?, options?, queryClient?)`
- `useSuspenseQuery(method, path, init?, options?, queryClient?)`
- `useInfiniteQuery(method, path, init?, options?, queryClient?)`
- `useMutation(method, path, options?, queryClient?)`

## Notes

- Query keys follow `[method, path, init]`, matching the documented `openapi-react-query` shape.
- Errors from `openapi-fetch` are re-thrown as `OpenApiVueQueryError` so Vue Query callers can rely on thrown errors.
- The package is intentionally a thin wrapper and keeps `openapi-fetch` as the source of request typing.

## Publishing

### Trusted Publishing 安全方針

npm Trusted Publishing（OIDC）を最終 publish 経路の第一候補とする。長期 npm token は原則使わない。

1. **PR trigger で publish しない** — `pull_request` / `pull_request_target` では publish ワークフローを起動しない。publish は `release` 作成または手動 `workflow_dispatch`（`main` 限定）のみ。
2. **publish workflow では cache / artifact を使わない** — ビルド成果物は同一ジョブ内で `pnpm pack` 直後に publish する。外部 artifact 経由の tarball 取り込みは禁止（サプライチェーン汚染防止）。
3. **`id-token: write` は publish workflow のみ** — CI の lint/test workflow には付与しない。権限は publish 専用 workflow に最小限定する。

その他: publish provenance を記録し、maintainer アカウントは 2FA 必須とする。

### P2 未決事項（publish 経路）

以下は **P2 で方針確定** する。現時点では基礎実装をブロックしない。

| 経路 | 概要 | 検討ポイント |
|------|------|--------------|
| `pnpm publish` | pnpm から直接 npm registry へ | workspace 設定・provenance・Trusted Publishing 連携の確認 |
| `pnpm pack` + `npm publish <tarball>` | tarball 生成後に npm CLI で publish | npm Trusted Publishing との相性、CI 手順の単純さ |
| npm Trusted Publishing（OIDC） | GitHub Actions → npm OIDC | **最終 publish 経路候補**として docs 上第一候補。workflow 分割と権限最小化が前提 |

→ P2 で上記 3 経路を比較し、採用経路と CI テンプレートを確定する。

## License Considerations

本 package は `openapi-react-query` / `openapi-fetch` の**公開 API 形状**を参考にしたクリーンルーム実装。第三者リポジトリからのソースコピーは禁止。

### MIT vs Apache-2.0（判断材料）

| 観点 | MIT | Apache-2.0 |
|------|-----|------------|
| 著作権表示 | 必須 | 必須 + NOTICE ファイル対応 |
| 特許条項 | 明示なし（暗黙の許諾に依存） | **明示的特許ライセンス** + 訴訟時のライセンス終了条項 |
| 変更告知 | 不要 | 変更ファイルの明示が必要 |
| npm エコシステム | 最も一般的（依存の大半が MIT） | 企業 OSS・ASF 系で多い |

**本 package は MIT を採用**（`package.json` の `license` フィールド参照）。理由:

- **AGPL 切離**: 参照元の `openapi-react-query`（AGPL-3.0）とはライセンスを切り離し、クリーンルーム実装＋MIT で再配布可能にする。
- **npm 慣行**: Vue / TanStack 周辺の薄い wrapper ライブラリは MIT が主流で、利用者の法務レビュー負荷が低い。
- **特許条項**: 特許リスクを明示的にカバーしたい場合は Apache-2.0 が有利だが、本 package は薄い API ラッパーであり、現フェーズでは MIT の簡潔さを優先。必要なら P2 で Apache-2.0 への変更を再検討する。
