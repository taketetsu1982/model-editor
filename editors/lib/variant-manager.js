// editors/lib/variant-manager.js — バリアントモード管理の純粋関数
(function(exports) {

  // モデルキー（バリアントに格納するキー）
  var MODEL_KEYS = ['objects', 'views', 'paneGraph', 'screens'];

  // バリアントIDとラベルの生成用（a→Option A, b→Option B, ...）
  var VARIANT_IDS   = 'abcdefghijklmnopqrstuvwxyz'.split('');
  var VARIANT_NAMES = VARIANT_IDS.map(function(id) {
    return 'Option ' + id.toUpperCase();
  });

  /**
   * バリアントモードかどうか判定する
   * @param {Object} data - モデルデータ
   * @returns {boolean}
   */
  exports.isVariantMode = function isVariantMode(data) {
    return Array.isArray(data._variants) && data._variants.length > 0;
  };

  /**
   * 通常モード→バリアントモードへ変換、またはバリアントを追加する
   * @param {Object} data - モデルデータ
   * @returns {Object} 新しいモデルデータ（元データを変更しない）
   */
  exports.toVariantMode = function toVariantMode(data) {
    if (!exports.isVariantMode(data)) {
      // 通常モード → バリアントモードに変換
      var modelData = {};
      MODEL_KEYS.forEach(function(key) {
        if (data[key] !== undefined) {
          modelData[key] = data[key];
        }
      });

      var variantA = Object.assign(
        { id: 'a', name: 'Option A', active: true },
        JSON.parse(JSON.stringify(modelData))
      );
      var variantB = Object.assign(
        { id: 'b', name: 'Option B', active: false },
        JSON.parse(JSON.stringify(modelData))
      );

      // パススルーキーを収集（モデルキー・_variants以外）
      var result = {};
      Object.keys(data).forEach(function(key) {
        if (MODEL_KEYS.indexOf(key) === -1 && key !== '_variants') {
          result[key] = data[key];
        }
      });
      result._variants = [variantA, variantB];
      return result;
    } else {
      // バリアントモード → アクティブバリアントをコピーして追加
      var activeVariant = exports.getActiveVariant(data);
      var nextIndex = data._variants.length;
      var nextId   = VARIANT_IDS[nextIndex]   || String(nextIndex);
      var nextName = VARIANT_NAMES[nextIndex] || ('Option ' + nextIndex);

      // アクティブバリアントからモデルキーのみを抽出してコピー
      var copyData = {};
      MODEL_KEYS.forEach(function(key) {
        if (activeVariant[key] !== undefined) {
          copyData[key] = activeVariant[key];
        }
      });

      var newVariant = Object.assign(
        { id: nextId, name: nextName, active: false },
        JSON.parse(JSON.stringify(copyData))
      );

      var result = {};
      Object.keys(data).forEach(function(key) {
        if (key !== '_variants') {
          result[key] = data[key];
        }
      });
      result._variants = data._variants.concat([newVariant]);
      return result;
    }
  };

  /**
   * アクティブなバリアントを返す
   * active: true のバリアントがなければ最初のバリアントをフォールバックとして返す
   * @param {Object} data - バリアントモードのモデルデータ
   * @returns {Object} バリアントオブジェクト
   */
  exports.getActiveVariant = function getActiveVariant(data) {
    var active = data._variants.find(function(v) { return v.active === true; });
    return active || data._variants[0];
  };

  /**
   * 指定したバリアントをアクティブにする（イミュータブル）
   * @param {Object} data - バリアントモードのモデルデータ
   * @param {string} variantId - アクティブにするバリアントのID
   * @returns {Object} 新しいモデルデータ
   */
  exports.switchVariant = function switchVariant(data, variantId) {
    var newVariants = data._variants.map(function(v) {
      return Object.assign({}, v, { active: v.id === variantId });
    });
    return Object.assign({}, data, { _variants: newVariants });
  };

  /**
   * 指定したバリアントを採用して通常モードに戻す（イミュータブル）
   * バリアントのモデルデータをトップレベルに昇格し、_variants を除去する
   * @param {Object} data - バリアントモードのモデルデータ
   * @param {string} variantId - 採用するバリアントのID
   * @returns {Object} 通常モードの新しいモデルデータ
   */
  exports.keepVariant = function keepVariant(data, variantId) {
    var target = data._variants.find(function(v) { return v.id === variantId; });
    // 指定IDが見つからない場合はアクティブバリアントを使う
    if (!target) {
      target = exports.getActiveVariant(data);
    }

    // パススルーキー（モデルキー・_variants以外）を収集
    var result = {};
    Object.keys(data).forEach(function(key) {
      if (MODEL_KEYS.indexOf(key) === -1 && key !== '_variants') {
        result[key] = data[key];
      }
    });

    // バリアントのモデルデータをディープコピーしてトップレベルに昇格
    MODEL_KEYS.forEach(function(key) {
      if (target[key] !== undefined) {
        result[key] = JSON.parse(JSON.stringify(target[key]));
      }
    });

    return result;
  };

  /**
   * 指定したバリアントを削除する（イミュータブル）
   * - 最後の1つを削除しようとした場合は変更なしで返す
   * - 削除後に1つだけ残った場合は keepVariant を呼んで通常モードへ自動解決する
   * - 削除したバリアントがアクティブだった場合は先頭を新たにアクティブにする
   * @param {Object} data - バリアントモードのモデルデータ
   * @param {string} variantId - 削除するバリアントのID
   * @returns {Object} 新しいモデルデータ
   */
  exports.deleteVariant = function deleteVariant(data, variantId) {
    // 最後の1つは削除できない
    if (data._variants.length <= 1) {
      return data;
    }

    var wasActive = data._variants.some(function(v) {
      return v.id === variantId && v.active === true;
    });

    var remaining = data._variants.filter(function(v) { return v.id !== variantId; });

    // 削除したバリアントがアクティブだった場合は先頭をアクティブにする
    if (wasActive) {
      remaining = remaining.map(function(v, i) {
        return Object.assign({}, v, { active: i === 0 });
      });
    }

    var newData = Object.assign({}, data, { _variants: remaining });

    // 残りが1つになったら自動解決して通常モードへ
    if (remaining.length === 1) {
      return exports.keepVariant(newData, remaining[0].id);
    }

    return newData;
  };

  /**
   * 指定したバリアントの名前を変更する（イミュータブル）
   * @param {Object} data - バリアントモードのモデルデータ
   * @param {string} variantId - 名前を変更するバリアントのID
   * @param {string} newName - 新しい名前
   * @returns {Object} 新しいモデルデータ
   */
  exports.renameVariant = function renameVariant(data, variantId, newName) {
    var newVariants = data._variants.map(function(v) {
      return v.id === variantId ? Object.assign({}, v, { name: newName }) : v;
    });
    return Object.assign({}, data, { _variants: newVariants });
  };

  /**
   * UI描画用のバリアント一覧を返す
   * @param {Object} data - モデルデータ
   * @returns {Array<{id: string, name: string, active: boolean}>}
   *   バリアントモードでなければ空配列を返す
   */
  exports.getVariantList = function getVariantList(data) {
    if (!exports.isVariantMode(data)) {
      return [];
    }
    return data._variants.map(function(v) {
      return {
        id: v.id,
        name: v.name,
        active: v.active === true,
      };
    });
  };

  /**
   * 指定したバリアントのモデルデータを部分更新する（イミュータブル）
   * updates のキーをバリアントにマージする（Object.assign スタイル）
   * @param {Object} data - バリアントモードのモデルデータ
   * @param {string} variantId - 更新するバリアントのID
   * @param {Object} updates - マージするデータ
   * @returns {Object} 新しいモデルデータ
   */
  exports.updateVariantData = function updateVariantData(data, variantId, updates) {
    var newVariants = data._variants.map(function(v) {
      return v.id === variantId ? Object.assign({}, v, updates) : v;
    });
    return Object.assign({}, data, { _variants: newVariants });
  };

})(typeof module !== 'undefined' ? module.exports : (window.__variantManager = window.__variantManager || {}));
