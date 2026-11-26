/**
 * analytics.js — classic script.
 * Parses notes['__TEST_RESULTS__'] or Supabase test_results to render the analytics dashboard.
 */
(function () {
  'use strict';

  var container;

  function i18n(k, fb) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(k) : null;
    return (v && v !== k) ? v : (fb || k);
  }

  function getResultsText(notes) {
    notes = notes || {};
    return notes['__TEST_RESULTS__'] || notes['Test Results'] || '';
  }

  function initAnalytics() {
    container = document.getElementById('analytics-workspace');
    if (!container) {
      container = document.createElement('div');
      container.id = 'analytics-workspace';
      var ws = document.querySelector('.input-workspace') || document.body;
      ws.appendChild(container);
    }

    window.subscribe(function (state, prev) {
      if (state.viewMode === 'analytics' &&
         (state.viewMode !== prev.viewMode || state.notes !== prev.notes || state.lang !== prev.lang)) {
        renderDashboard(getResultsText(state.notes));
      }
    });

    window.addEventListener('cloud-hydrated', function () {
      if (window.getState().viewMode === 'analytics') {
        renderDashboard(getResultsText(window.getState().notes));
      }
    });

    // Initial render if we booted into analytics
    var bootState = window.getState();
    if (bootState.viewMode === 'analytics') {
      renderDashboard(getResultsText(bootState.notes));
    }
  }

  function renderDashboard(rawText) {
    if (!container) return;

    var data = (window.cloudSync && window.cloudSync.isAuthenticated())
      ? parseCloudResults(window.cloudSync.getTestResults())
      : parseResults(rawText);

    container.replaceChildren();

    if (data.totalSessions === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      var emptyP = document.createElement('p');
      emptyP.textContent = i18n('analyticsEmpty', 'No analytics test data found. Complete an exam to see dashboard!');
      emptyDiv.appendChild(emptyP);
      container.appendChild(emptyDiv);
      return;
    }

    var summaryGrid = document.createElement('div');
    summaryGrid.className = 'analytics-summary-grid';

    var totalCard = document.createElement('div');
    totalCard.className = 'stat-card';
    var totalH3 = document.createElement('h3');
    totalH3.textContent = i18n('analyticsTotalTests', 'Total Tests');
    var totalP = document.createElement('p');
    totalP.className = 'stat-number';
    totalP.textContent = String(data.totalSessions);
    totalCard.appendChild(totalH3);
    totalCard.appendChild(totalP);
    summaryGrid.appendChild(totalCard);

    var avgAccuracy = data.totalQuestions > 0
      ? Math.round((data.totalCorrect / data.totalQuestions) * 100)
      : 0;

    var accCard = document.createElement('div');
    accCard.className = 'stat-card';
    var accH3 = document.createElement('h3');
    accH3.textContent = i18n('analyticsAvgAccuracy', 'Average Accuracy');
    var accP = document.createElement('p');
    accP.className = 'stat-number';
    accP.textContent = avgAccuracy + '%';
    accCard.appendChild(accH3);
    accCard.appendChild(accP);
    summaryGrid.appendChild(accCard);

    container.appendChild(summaryGrid);

    var troubleCard = document.createElement('div');
    troubleCard.className = 'stat-card trouble-list-card';
    var troubleH3 = document.createElement('h3');
    troubleH3.textContent = i18n('analyticsTopMissed', 'Top 5 Missed Items');
    troubleCard.appendChild(troubleH3);

    if (data.missedTracker.length === 0) {
      var perfectP = document.createElement('p');
      perfectP.className = 'success-message';
      perfectP.textContent = i18n('analyticsPerfect', 'Perfect score! No missed items tracked.');
      troubleCard.appendChild(perfectP);
    } else {
      var ul = document.createElement('ul');
      data.missedTracker.slice(0, 5).forEach(function (item) {
        var li = document.createElement('li');

        var wordSpan = document.createElement('span');
        wordSpan.className = 'missed-word-text';
        wordSpan.textContent = item.word;

        var countSpan = document.createElement('span');
        countSpan.className = 'missed-count';
        countSpan.textContent = '(' + item.count + 'x)';

        li.appendChild(wordSpan);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(countSpan);
        ul.appendChild(li);
      });
      troubleCard.appendChild(ul);
    }

    container.appendChild(troubleCard);
  }

  function parseCloudResults(rows) {
    rows = rows || [];
    var totalSessions = rows.length;
    var totalCorrect = 0, totalQuestions = 0;
    var missedCounts = {};

    rows.forEach(function (r) {
      totalCorrect += Number(r.correct_count) || 0;
      totalQuestions += Number(r.total_questions) || 0;
      (r.missed_items || []).forEach(function (item) {
        var key = (item && item.prompt) ? String(item.prompt).trim() : '';
        if (key) missedCounts[key] = (missedCounts[key] || 0) + 1;
      });
    });

    var missedTracker = Object.keys(missedCounts)
      .map(function (k) { return { word: k, count: missedCounts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });

    return { totalSessions: totalSessions, totalCorrect: totalCorrect, totalQuestions: totalQuestions, missedTracker: missedTracker };
  }

  function parseResults(text) {
    if (!text) return { totalSessions: 0, totalCorrect: 0, totalQuestions: 0, missedTracker: [] };
    
    var logs = text.split('---');
    var totalSessions = 0, totalCorrect = 0, totalQuestions = 0;
    var missedCounts = {};

    logs.forEach(function (log) {
      var lines = log.split('\n')
        .filter(function (l) { return l.trim(); });
      if (!lines.length) return;

      var m = null;
      lines.forEach(function (l) {
        if (l.indexOf('→') !== -1 || /^[ \t]/.test(l)) return;
        var mm = l.match(/(\d+)\s+(?:out\s+of|trên|\/)\s+(\d+)/i);
        if (mm) m = mm;
      });
      if (!m) return;

      totalSessions++;
      totalCorrect   += parseInt(m[1], 10) || 0;
      totalQuestions += parseInt(m[2], 10) || 0;

      lines.forEach(function (l) {
        if (l.indexOf('→') !== -1) {
          var key = l.split('→')[0].trim();
          if (key) missedCounts[key] = (missedCounts[key] || 0) + 1;
        }
      });
    });

    var missedTracker = Object.keys(missedCounts)
      .map(function (k) { return { word: k, count: missedCounts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });

    return { totalSessions: totalSessions, totalCorrect: totalCorrect, totalQuestions: totalQuestions, missedTracker: missedTracker };
  }

  window.initAnalytics = initAnalytics;
})();
