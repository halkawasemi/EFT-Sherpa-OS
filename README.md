# EFT Sherpa OS v0.56 (PvE Mode)
**究極のタルコフ・タクティカル・コンパニオンツール**

<!-- バッジ（装飾） -->

<!-- ここに公開URLへのリンクボタンを配置 -->
[**🚀 アプリを起動する (Launch App)**](https://halkawasemi.github.io/EFT-Sherpa-OS/)

[**🚀 旧バージョン（v0.42）はこちら (Launch App)**](https://halkawasemi.github.io/EFT-Sherpa-OS/v0.42.html)

🔰 概要 (Overview)

EFT Sherpa OSは、Escape from Tarkov (PvEモード推奨) プレイヤーのために開発された、軽量かつ多機能なWebベースの統合管理ツールです。

Wikiや複数のサイトを行き来する必要はもうありません。「タスク管理」「市場価格」「ハイドアウト」「ガンスミス」――すべての情報を一つの画面に集約し、あなたのレイドと生存率を強力にサポートします。

v0.56 Update: 物資調達を支援する「Wishlist」機能と、製造ラインを最適化する「Craft Search」を実装しました。

✨ v0.56 新機能 (New Features)

⭐ Wishlist（欲しいものリスト）

市場監視の負担を軽減するブックマーク機能を搭載しました。

アイテムの「⭐」をクリックするだけでリストに登録。

専用タブで「現在の最安値・最高値・平均価格」を一括監視できます。

🛠 Enhanced Craft Search（クラフト検索強化）

逆引き検索: 素材名で検索すると、「その素材を使って何が作れるか」を即座に表示します。

利益計算: クラフトにかかるコストと売却益を自動計算し、利益が出るレシピを可視化します。

スマートフィルター: 「タスク提出に使えるクラフト」「ハイドアウト拡張に使えるクラフト」を絞り込み表示可能。

🛠 主な機能 (Key Features)

1. Market Monitor (市場価格 & インテリジェンス)

PvEモードのフリーマーケット価格をAPI連携でリアルタイム表示します。

スマートバッジ: アイテム名を入力すると、価格だけでなく「タスク提出品か？」「ハイドアウト要求品か？」を自動判定し、バッジで警告します。

Requirement Matrix: 現在進行中のタスクやハイドアウトで、あと何個必要かをミニパネルで表示します。

2. Task Database (タスク管理)

進行管理: チェックボックスで進行状況を保存（ブラウザに記憶）。

シェルパ・アドバイス: 初心者が詰まりやすいタスクには、ベテラン（シェルパ）視点の攻略Tipsを表示。

詳細フィルター: トレーダー別、マップ別、Kappa必須などで絞り込みが可能。

3. Hideout Manager (ハイドアウト管理)

施設のレベルを管理することで、「次に必要な素材リスト」を自動生成します。

ここで入力したレベル情報は、Market画面の「必要素材判定」に連動します。

4. Interactive Gunsmith (ガンスミス)

Auto Assemble: 目標の「エルゴノミクス」や「反動」数値を入力して Auto ボタンを押すと、条件を満たす最適なパーツ構成を自動で組み上げるシミュレーターです。

📖 導入方法 (How to Use)

このツールはWebアプリです。インストール不要で、PC・スマホ問わずすぐにご利用いただけます。

方法A：Webブラウザで使う（推奨）

ページ上部の 「🚀 Launch Sherpa OS」 リンクをクリックしてください。

方法B：ローカルで使う

このリポジトリの index.html をダウンロードし、お使いのブラウザ（Chrome, Edge, Safari等）で開くことでも動作します。

⚙️ 技術仕様 & データ (Technical)

Architecture: Single File HTML / Vanilla JS / Tailwind CSS

Data Source: tarkov.dev API (GraphQL)

Storage: LocalStorage (ブラウザのキャッシュをクリアすると進行状況がリセットされます)

Credit & License

Developed by: Sherpa OS Dev Team

License: MIT License / Free to use for all PMC operators.

Escape from Tarkov is a trademark of Battlestate Games Limited.
