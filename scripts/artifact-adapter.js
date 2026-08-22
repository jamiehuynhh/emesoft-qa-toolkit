/* =============================================================================
   Artifact runtime adapter — appended to the single-file build only.
   -----------------------------------------------------------------------------
   Eleven tools offer a file through QAT.download(), which builds a Blob and
   clicks an <a download>. That is correct on every ordinary host and from
   file://, but the claude.ai artifact viewer never grants a page download
   permission, so there the button does nothing at all — no file, no error, no
   clue. A QA toolkit whose "Download CSV" silently fails is broken.

   So when the artifact runtime is present, QAT.download is re-pointed at
   claude.downloads.save(), which asks the viewer to confirm and can be
   declined. When it is absent — a static host, a USB stick, file:// — this
   file changes nothing and the original Blob path runs.

   It lives in scripts/ rather than js/ on purpose: build.js copies only
   assets/ and js/, and refuses outright to publish anything from scripts/, so
   this cannot leak into the static bundle where it has no business running.
   ========================================================================== */
(function () {
  'use strict';

  // Not the artifact viewer: leave the Blob download alone.
  if (!window.claude || typeof window.claude.use !== 'function' || !window.QAT) return;

  var ready = window.claude.use('downloads');
  var original = QAT.download;

  /* The viewer's base allowlist. .csv needs extended types enabled and .sql is
     on neither list, so a plain .txt retry is the difference between a tester
     getting their data and getting nothing. */
  var BASE_ALLOWED = /\.(txt|json|md|png|jpe?g|gif|webp|mp4|webm)$/i;

  function offer(downloads, filename, data, retried) {
    return downloads.save({ filename: filename, data: data }).then(
      function () {
        QAT.toast(QAT.t('msg.downloaded') + ' ' + filename, 'ok');
      },
      function (err) {
        var code = (err && err.code) || 'unavailable';

        if (!retried && (code === 'rejected_extension' || code === 'extension_not_enabled')) {
          // Keep the original extension in the name so it is still obvious what
          // the file is; only the saved type changes.
          return offer(downloads, filename + '.txt', data, true);
        }
        if (code === 'declined') {
          QAT.toast(QAT.L('Save cancelled.', 'Đã huỷ lưu.'));
          return;
        }
        if (code === 'rate_limited') {
          QAT.toast(QAT.L('Another save is still waiting for you. Finish that one, then try again.',
            'Còn một lượt lưu đang chờ bạn xác nhận. Xong lượt đó rồi thử lại.'));
          return;
        }
        if (code === 'too_large') {
          QAT.toast(QAT.L('Too big to save here (limit 16 MB). Narrow the input and try again.',
            'Quá lớn để lưu ở đây (giới hạn 16 MB). Hãy thu hẹp dữ liệu rồi thử lại.'), 'err');
          return;
        }
        QAT.toast(QAT.L('Could not save the file: ', 'Không lưu được file: ') +
          ((err && err.message) || code), 'err');
      }
    );
  }

  /* Returns a promise that settles when the save has been offered and answered.
     The original helper returns nothing and all 14 call sites ignore the return
     value, so this only adds something to hold on to -- the tests await it. */
  QAT.download = function (filename, content, mime) {
    // Excel reads a CSV as the system codepage without this, which mangles
    // Vietnamese. Same rule as the original helper.
    var data = (/\.csv$/i.test(filename) ? '﻿' : '') + content;

    return ready.then(function (downloads) {
      if (!downloads) {
        // Saving is not available in this view. Say so rather than appearing to
        // work: the text is on screen already, so copying is the way out.
        QAT.toast(QAT.L('Downloads are not available in this view — use Copy instead.',
          'Bản này không tải file được — hãy dùng nút Copy.'), 'err');
        return;
      }
      return offer(downloads, filename, data, false);
    }).catch(function (e) {
      QAT.toast(QAT.L('Could not save the file: ', 'Không lưu được file: ') +
        ((e && e.message) || e), 'err');
    });
  };

  // Kept reachable so a future non-artifact use of this file can restore it.
  QAT.downloadViaBlob = original;

  // Names the extensions the viewer takes without a retry, for anything that
  // wants to pick a format up front rather than find out on rejection.
  QAT.downloadExtensionIsNative = function (filename) { return BASE_ALLOWED.test(filename); };
})();
