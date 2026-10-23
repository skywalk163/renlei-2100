(function () {
  'use strict';

  var ENDPOINT = '/api/simulate';

  var form = document.getElementById('sim-form');
  var runBtn = document.getElementById('run');
  var randomBtn = document.getElementById('random');
  var results = document.getElementById('results');
  var output = document.getElementById('output');
  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('status-text');

  var fields = [
    { input: document.getElementById('tech'), output: document.getElementById('tech-value') },
    { input: document.getElementById('empathy'), output: document.getElementById('empathy-value') },
    { input: document.getElementById('choice'), output: document.getElementById('choice-value') }
  ];

  var busy = false;
  var hasResult = false;
  var lastValues = null;

  // 静态版：预演表由 Light 引擎生成（11×11×11=1331 组）。存在时完全不请求后端。
  var lookup = null;
  if (Array.isArray(window.__预演表)) {
    lookup = Object.create(null);
    window.__预演表.forEach(function (row) {
      if (row && row['结果']) {
        lookup[snap(row['技术']) + '|' + snap(row['共情']) + '|' + snap(row['选择'])] = row['结果'];
      }
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function clampInt(raw) {
    var n = Math.round(Number(raw));
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.min(100, Math.max(0, n));
  }

  function snap(raw) {
    return Math.min(100, Math.max(0, Math.round(clampInt(raw) / 10) * 10));
  }

  function syncField(field) {
    var value = clampInt(field.input.value);
    field.output.textContent = String(value);
    field.input.style.setProperty('--fill', value + '%');
  }

  function readValues() {
    return {
      '技术': clampInt(fields[0].input.value),
      '共情': clampInt(fields[1].input.value),
      '选择': clampInt(fields[2].input.value)
    };
  }

  function setStatus(text, state) {
    statusText.textContent = text;
    statusEl.className = 'status' + (state ? ' status--' + state : '');
  }

  function setBusy(next) {
    busy = next;
    runBtn.disabled = next;
    randomBtn.disabled = next;
    runBtn.textContent = next ? '推演中…' : '推演 2100';
    if (next) {
      results.setAttribute('aria-busy', 'true');
    } else {
      results.removeAttribute('aria-busy');
    }
  }

  function placeholder() {
    var box = el('div', 'placeholder');
    box.appendChild(el('p', 'placeholder__mark', '2100'));
    box.firstChild.setAttribute('aria-hidden', 'true');
    box.appendChild(el('p', 'placeholder__title', '尚未推演'));
    box.appendChild(el('p', 'placeholder__text', '调整「技术速率 / 共情浓度 / 集体选择」，然后按下「推演 2100」。'));
    box.appendChild(el('p', 'placeholder__sub', '你将得到：存续指数、三条未来分支、三个转折点，以及一封来自 2100 年的回信。'));
    return box;
  }

  function showPlaceholder() {
    hasResult = false;
    output.classList.remove('is-loading');
    output.replaceChildren(placeholder());
  }

  function showLoading() {
    setStatus('推演中 · 正在读取三条分支', 'busy');
    output.classList.add('is-loading');
    if (!hasResult) {
      var box = el('div', 'loading');
      box.appendChild(el('p', 'loading__text', '正在推演一个世纪'));
      box.appendChild(el('p', 'loading__sub', '技术、共情与选择正在汇入同一条时间线。'));
      output.replaceChildren(box);
    }
  }

  function showError(message) {
    hasResult = false;
    output.classList.remove('is-loading');
    setStatus('未完成 · 可以重试', 'error');

    var notice = el('div', 'notice');
    notice.appendChild(el('p', 'notice__title', '推演中断'));
    notice.appendChild(el('p', 'notice__msg', message));

    var actions = el('div', 'notice__actions');
    var retry = el('button', 'btn btn--ghost', '重试');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      simulate(lastValues || readValues());
    });
    actions.appendChild(retry);
    notice.appendChild(actions);
    output.replaceChildren(notice);
  }

  function renderResult(data, label) {
    hasResult = true;
    output.classList.remove('is-loading');
    output.replaceChildren(buildResult(data));
    setStatus(label, 'ok');
  }

  function describeError(err) {
    if (err && err.code === 'HTTP') {
      return '推演服务返回了 ' + err.status + '，本次推演没有完成。请稍后重试。';
    }
    if (err && err.code === 'PARSE') {
      return '推演服务返回的内容无法解析，本次推演已中止。请重试。';
    }
    if (err && err.code === 'SHAPE') {
      return '推演服务返回的数据不符合接口契约，无法渲染结果。请重试。';
    }
    return '无法连接推演服务。请确认本地服务已在 127.0.0.1:2100 启动，然后重试。';
  }

  function requestError(code, status) {
    var err = new Error(code);
    err.code = code;
    if (status !== undefined) {
      err.status = status;
    }
    return err;
  }

  function isValid(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }
    if (typeof data['存续指数'] !== 'number' || !Number.isFinite(data['存续指数'])) {
      return false;
    }
    if (typeof data['判定'] !== 'string' || typeof data['一句话'] !== 'string') {
      return false;
    }
    if (typeof data['回信'] !== 'string') {
      return false;
    }
    if (!Array.isArray(data['分支']) || data['分支'].length !== 3) {
      return false;
    }
    var branchesOk = data['分支'].every(function (item) {
      return item && typeof item === 'object' &&
        typeof item['名称'] === 'string' &&
        typeof item['概率'] === 'number' &&
        Number.isFinite(item['概率']) &&
        typeof item['描述'] === 'string' &&
        typeof item['信号'] === 'string';
    });
    if (!branchesOk) {
      return false;
    }
    if (!Array.isArray(data['转折点']) || data['转折点'].length !== 3) {
      return false;
    }
    return data['转折点'].every(function (item) {
      return typeof item === 'string';
    });
  }

  function subLabel(text) {
    return el('h3', 'sub-label', text);
  }

  function buildResult(data) {
    var result = el('div', 'result');

    var scoreValue = clampInt(data['存续指数']);
    var verdict = el('div', 'verdict');
    var score = el('div', 'score');
    score.appendChild(el('span', 'score__label', '存续指数'));
    score.appendChild(el('span', 'score__num', String(scoreValue)));
    verdict.appendChild(score);
    verdict.appendChild(el('p', 'verdict__tag', data['判定']));
    result.appendChild(verdict);

    var meter = el('div', 'meter');
    meter.setAttribute('aria-hidden', 'true');
    var meterFill = el('span', 'meter__fill');
    meterFill.style.width = scoreValue + '%';
    meter.appendChild(meterFill);
    result.appendChild(meter);

    var scale = el('div', 'meter-scale');
    scale.setAttribute('aria-hidden', 'true');
    scale.appendChild(el('span', null, '0'));
    scale.appendChild(el('span', null, '100'));
    result.appendChild(scale);

    result.appendChild(el('p', 'oneline', data['一句话']));

    result.appendChild(subLabel('三条未来分支'));

    var branches = el('ol', 'branches');
    data['分支'].forEach(function (item) {
      var li = el('li', 'branch');
      var head = el('div', 'branch__head');
      head.appendChild(el('span', 'branch__name', item['名称']));
      var probability = clampInt(item['概率']);
      head.appendChild(el('span', 'branch__prob', probability + '%'));
      li.appendChild(head);

      var bar = el('div', 'bar');
      bar.setAttribute('aria-hidden', 'true');
      var barFill = el('span', 'bar__fill');
      barFill.style.width = probability + '%';
      bar.appendChild(barFill);
      li.appendChild(bar);

      li.appendChild(el('p', 'branch__desc', item['描述']));

      var signal = el('p', 'branch__signal');
      signal.appendChild(el('span', 'branch__signal-label', '信号'));
      signal.appendChild(document.createTextNode(item['信号']));
      li.appendChild(signal);

      branches.appendChild(li);
    });
    result.appendChild(branches);

    result.appendChild(subLabel('三条转折点'));

    var timeline = el('ol', 'timeline');
    data['转折点'].forEach(function (item) {
      var li = el('li', 'tl');
      var dot = el('span', 'tl__dot');
      dot.setAttribute('aria-hidden', 'true');
      li.appendChild(dot);

      var matched = String(item).match(/^\s*(\d{4})\s*(?:[·:：\-–—]\s*)?(.+)$/);
      if (matched) {
        li.appendChild(el('span', 'tl__year', matched[1]));
        li.appendChild(el('p', 'tl__text', matched[2]));
      } else {
        li.appendChild(el('p', 'tl__text', item));
      }
      timeline.appendChild(li);
    });
    result.appendChild(timeline);

    var letter = el('blockquote', 'letter');
    letter.appendChild(el('p', 'letter__label', '来自 2100 年的回信'));
    letter.appendChild(el('p', 'letter__body', '“' + data['回信'] + '”'));
    result.appendChild(letter);

    return result;
  }

  async function simulate(values) {
    if (busy) {
      return;
    }
    lastValues = values;
    setBusy(true);
    showLoading();

    try {
      if (lookup) {
        var key = snap(values['技术']) + '|' + snap(values['共情']) + '|' + snap(values['选择']);
        var cached = lookup[key];
        if (cached && isValid(cached)) {
          renderResult(cached, '推演完成 · 静态预演（结果由 Light 生成）');
          return;
        }
      }

      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        cache: 'no-store'
      });

      if (!res.ok) {
        throw requestError('HTTP', res.status);
      }

      var data;
      try {
        data = await res.json();
      } catch (err) {
        throw requestError('PARSE');
      }

      if (!isValid(data)) {
        throw requestError('SHAPE');
      }

      renderResult(data, '推演完成 · 三条分支已生成');
    } catch (err) {
      showError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  fields.forEach(function (field) {
    syncField(field);
    field.input.addEventListener('input', function () {
      syncField(field);
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) {
      return;
    }
    simulate(readValues());
  });

  randomBtn.addEventListener('click', function () {
    if (busy) {
      return;
    }
    fields.forEach(function (field) {
      var value = 10 + Math.floor(Math.random() * 81);
      field.input.value = String(value);
      syncField(field);
    });
    simulate(readValues());
  });

  showPlaceholder();
  setStatus('就绪 · 调整变量后开始推演', '');

  // 分享/截图用：?auto=1 自动推演一次，可带 技术/共情/选择 参数。
  var params = new URLSearchParams(window.location.search);
  if (params.get('auto') === '1') {
    var keys = ['技术', '共情', '选择'];
    var defaults = [20, 90, 30];
    fields.forEach(function (field, index) {
      var raw = params.get(keys[index]);
      field.input.value = String(raw === null ? defaults[index] : clampInt(raw));
      syncField(field);
    });
    simulate(readValues());
  }
})();
